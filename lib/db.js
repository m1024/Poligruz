var pg = require('pg');
var config = require('../config.json');
var pool = new pg.Pool(config.db);
var moment = require('moment');
var Logger = require('logplease');
var log = Logger.create('db', { filename: './logs/log.log'});
var db =  {};

// Функция-обертка для выполнения запроса
db.query = function (query, cb) {
    //Логирование события
    log.debug('DB query: ' + query);

    pool.query(query, function (err, res) {
        if (err) {
            log.error('Qery error:', err);
            cb(err);
        }
        else
            cb(false, res);
    });
};

// Функция перебора дерева страниц с разрешениями на вычленение разрешений
extractPermissionsFromTree = function (tree) {
    var permissions = [];
    for (var i = 0; i < tree.length; i++) {
        if (tree[i].type === 'checkbox') {
            permissions.push(tree[i]);
        }
        if (tree[i].submenu && tree[i].submenu.length > 0) {
            var data = extractPermissionsFromTree(tree[i].submenu);
            permissions = permissions.concat(data);
        }
    }
    return permissions;
};


// Найти пользователя по его логину и хешу пароля
db.getUserByLogin = function (login, passwordHash, cb) {
    var query = 'SELECT * FROM users WHERE login = \'' + login + '\' AND password_hash = \'' + passwordHash + '\' AND enable = TRUE;';
    db.query(query, function (err, res) {
        if (err || res.rows.length === 0)
            cb(undefined);
        // Пользователь найден
        else {
            var user = JSON.stringify(res.rows[0]);
            user = JSON.parse(user);

            // Поиск инфо о человеке к которому привязана данная учетная запись
            var query = 'SELECT * FROM persons WHERE person_id=' + user.person_id + ';';
            db.query(query, function (err, res) {
                if (err)
                    throw err;
                else {
                    var person = JSON.stringify(res.rows[0]);
                    person = JSON.parse(person);

                    delete user.person_id;
                    user['person'] = person;
                    cb(user);
                }
            });
        }
    });
};

// Запрос списка разрешений для пользователя по его ID
db.getUserPermissions = function (userID, cb) {
    var query = 'SELECT p.permission_id, p.name FROM users AS u\
            INNER JOIN users_groups ug ON u.user_id = ug.user_id\
            INNER JOIN groups_permissions gp ON gp.group_id = ug.group_id\
            INNER JOIN permissions p ON gp.permission_id = p.permission_id\
        WHERE u.user_id = ' + userID + ';';
    db.query(query, function (err, res) {
        if (err)
            throw err;
        else {
            var permissions = JSON.stringify(res.rows);
            permissions = JSON.parse(permissions);
            cb(permissions);
        }
    });
};

// Поиск страницы по ее URL
db.getPageByURL = function (url, cb) {
    var query = 'SELECT * FROM pages WHERE url=\'' + url + '\';';
    db.query(query, function (err, res) {
        if (err || res.rows.length === 0)
            cb(undefined);
        // Страница найдена
        else {
            var page = JSON.stringify(res.rows[0]);
            page = JSON.parse(page);

            cb(page);
        }
    });
};

// Функция проверки прав доступа пользователя к странице
db.checkUserPermissionViewPage = function (url, user, cb) {
    var query = 'SELECT * FROM pages \
            INNER JOIN groups_permissions ON pages.view_permission_id = groups_permissions.permission_id \
            INNER JOIN users_groups ON groups_permissions.group_id = users_groups.group_id \
            INNER JOIN users ON users_groups.user_id = users.user_id \
        WHERE \
            pages.url=\'' + url + '\' AND users.user_id=' + user.user_id + ';';
    db.query(query, function (err, res) {
        if (err)
            throw err;
        else
            cb(res.rows.length !== 0);
    });
};

// Список всех страниц
db.getSidebarAllPages = function (cb) {
    var query = 'SELECT * FROM pages \
        ORDER BY page_id ASC;';
    db.query(query, function (err, res) {
        if (err)
            throw err;
        else {
            var pages = JSON.stringify(res.rows);
            pages = JSON.parse(pages);
            cb(pages);
        }
    });
};

// Список доступных страниц пользователя в виде дерева
db.getSidebarPagesForUser = function (user, cb) {
    var query = 'SELECT page_id, url, path, title, description, icon, menu_level, menu_index, parent_page_id FROM pages \
            INNER JOIN groups_permissions ON pages.view_permission_id = groups_permissions.permission_id \
            INNER JOIN users_groups ON groups_permissions.group_id = users_groups.group_id \
            INNER JOIN users ON users_groups.user_id = users.user_id \
        WHERE \
            users.user_id = ' + user.user_id +
        ' ORDER BY page_id ASC;';
    db.query(query, function (err, res) {
        if (err)
            throw err;
        else {
            var pages = JSON.stringify(res.rows);
            pages = JSON.parse(pages);

            let pagesUnic = [];
            for(let i =0; i<pages.length; i++){
                let finded = pagesUnic.find(obj => obj.url === pages[i].url); //ищем элемент
                if (finded === undefined) //если нет, добавляем
                {
                    pagesUnic.push(pages[i]);
                }
                //если да, ничего не делаем
            }
            pages = pagesUnic; //удалили дублирование

            cb(pages);
        }
    });
};

// Функция проверки прав доступа пользователя к команде
db.getCommandPermissions = function (commandName, user, cb) {
    var query = 'SELECT COUNT(*) \
            FROM commands \
                INNER JOIN permissions ON commands.permission_id = permissions.permission_id \
                INNER JOIN groups_permissions ON permissions.permission_id = groups_permissions.permission_id \
                INNER JOIN groups ON groups_permissions.group_id = groups.group_id \
                INNER JOIN users_groups ON groups.group_id = users_groups.group_id \
                INNER JOIN users ON users.user_id = users_groups.user_id \
            WHERE \
                commands.name = \'' + commandName + '\' \
                AND users.login = \'' + user.login + '\';';
    db.query(query, function (err, res) {
        if (err)
            throw err;
        else {
            res = JSON.stringify(res.rows[0]);
            res = JSON.parse(res);
            cb(parseInt(res.count) >= 1);
        }
    });
};

// Получить все пользовательские группы
db.getUsersGroups = function (cb) {
    var query = 'SELECT * FROM groups;';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var groups = JSON.stringify(res.rows);
            groups = JSON.parse(groups);
            cb(false, groups);
        }
    });
};

// Получить список пользователей не входящих в группу с ID
db.getNotGroupUsers = function (groupID, cb) {
    var query = 'SELECT users.user_id, users.login, users.enable, p.person_id, p.surname, p.name, p.patronymic, p.birth_date, p.avatar, trim(BOTH FROM p.surname || \' \' || p.name || \' \' || p.patronymic) AS full_snp\
        FROM users\
            LEFT OUTER JOIN users_groups ug ON users.user_id = ug.user_id\
            INNER JOIN persons p ON users.person_id = p.person_id\
            LEFT OUTER JOIN groups g ON ug.group_id = g.group_id\
        WHERE\
            g.group_id !=' + groupID + ' OR g.group_id IS NULL;';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var users = JSON.stringify(res.rows);
            users = JSON.parse(users);
            cb(false, users);
        }
    });
};

// Получить список пользователей определенной группы пользователей
db.getGroupUsers = function (groupID, cb) {
    var query = 'SELECT *, trim(BOTH FROM persons.surname || \' \' || persons.name || \' \' || persons.patronymic) AS full_snp\
        FROM groups\
            INNER JOIN users_groups ON groups.group_id = users_groups.group_id\
            INNER JOIN users ON users_groups.user_id = users.user_id\
            INNER JOIN persons ON users.person_id = persons.person_id\
        WHERE\
            groups.group_id = ' + groupID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var users = JSON.stringify(res.rows);
            users = JSON.parse(users);
            cb(false, users);
        }
    });
};

// Получить группу по ее ID
db.getUsersGroup = function (groupID, cb) {
    var query = 'SELECT * FROM groups WHERE group_id = ' + groupID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var group = JSON.stringify(res.rows[0]);
            group = JSON.parse(group);
            cb(false, group);
        }
    });
};

// Получение списка разрешений
db.getPermissions = function (cb) {
    var query = 'SELECT *, permissions.description FROM permissions\
            INNER JOIN pages ON permissions.owner_page_id = pages.page_id\
        ORDER BY pages.page_id;';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var permissions = JSON.stringify(res.rows);
            permissions = JSON.parse(permissions);
            cb(false, permissions);
        }
    });
};

// Получить список разрешений для группы
db.getUsersGroupPermissions = function (groupID, cb) {
    var query = 'SELECT * FROM permissions\
            INNER JOIN groups_permissions g ON permissions.permission_id = g.permission_id\
        WHERE g.group_id = ' + groupID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var permissions = JSON.stringify(res.rows);
            permissions = JSON.parse(permissions);
            cb(false, permissions);
        }
    });
};

// Добавить группу пользователей
db.addUsersGroup = function (group, cb) {
    var query = 'INSERT INTO groups (name, description) VALUES (\'' + group.name + '\', \'' + group.description + '\');';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Изменить данные группы пользователей
db.saveUsersGroup = function (group, tree, cb) {
    if (group && tree) {
        // Изменение данных самой группы
        var query = 'UPDATE groups SET name = \'' + group.name + '\', description = \'' + group.description + '\' WHERE group_id = ' + group.group_id + ';';
        db.query(query, function (err, res) {
            if (err)
                cb(err);
            else {
                // Изменение разрешений группы
                // Получение списка разрешений для группы
                var permissions = extractPermissionsFromTree(tree);
                var arr = permissions.filter(function (value) {
                    return value.checked;
                });
                var values = '';
                for (var i = 0; i < arr.length; i++) {
                    values = values + '(' + group.group_id + ', ' + arr[i].permission_id + '),';
                }
                values = values.slice(0, -1);

                // Удаление старых разрешений
                query = 'DELETE FROM groups_permissions WHERE group_id = ' + group.group_id + ';';
                db.query(query, function (err, res) {
                    if (err)
                        cb(err);
                    else {
                        // Добавление новых разрешений
                        if (values !== '') {
                            query = 'INSERT INTO groups_permissions (group_id, permission_id) VALUES ' + values + ';';
                            db.query(query, function (err, res) {
                                cb(err);
                            });
                        }
                        cb(err);
                    }
                });
            }
        });
    }
    else
        cb(true);
};

// Удаление группы пользователей
db.delUsersGroup = function (groupID, cb) {
    var query = 'DELETE FROM groups WHERE group_id = ' + groupID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};

// Добавить пользователя в группу
db.addUserToGroup = function (groupID, userID, cb) {
    var query = 'INSERT INTO users_groups (user_id, group_id) VALUES (\'' + userID + '\', \'' + groupID + '\');';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Удалить пользователя из группы
db.delUserFromGroup = function (groupID, userID, cb) {
    var query = 'DELETE FROM users_groups WHERE user_id = ' + userID + ' AND group_id = ' + groupID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};


// Получить список групп пользователя
db.getUserGroups = function (userID, cb) {
    var query = 'SELECT * FROM groups\
            INNER JOIN users_groups ug ON groups.group_id = ug.group_id\
        WHERE ug.user_id = ' + userID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var groups = JSON.stringify(res.rows);
            groups = JSON.parse(groups);
            cb(false, groups);
        }
    });
};


/*=================================================== Пользователи ===================================================*/

// Получить список пользователей
db.getUsers = function (cb) {
    var query = 'SELECT *, trim(BOTH FROM persons.surname || \' \' || persons.name || \' \' || persons.patronymic) AS full_snp\
        FROM users\
        INNER JOIN persons ON users.person_id = persons.person_id;';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var users = JSON.stringify(res.rows);
            users = JSON.parse(users);
            cb(false, users);
        }
    });
};

// Получить пользователя по его ID
db.getUser = function (userID, cb) {
    var query = 'SELECT *, trim(BOTH FROM persons.surname || \' \' || persons.name || \' \' || persons.patronymic) AS full_snp\
        FROM users\
            INNER JOIN persons ON users.person_id = persons.person_id\
        WHERE user_id = ' + userID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var user = JSON.stringify(res.rows[0]);
            user = JSON.parse(user);
            cb(false, user);
        }
    });
};

// Смена пароля пользователя
db.changeUserPassword = function (userID, passwordHash, cb) {
    var query = 'UPDATE users SET password_hash = \'' + passwordHash + '\' WHERE user_id = ' + userID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};

// Получить список пользователей персоны по ее ID
db.getPersonUsers = function (personID, cb) {
    var query = 'SELECT * FROM users WHERE person_id = ' + personID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var users = JSON.stringify(res.rows);
            users = JSON.parse(users);
            cb(false, users);
        }
    });
};

// Добавить пользователя
db.addUser = function (user, cb) {
    var query = 'INSERT INTO users (login, password_hash, enable, person_id)\
        VALUES (\'' + user.login + '\', \'' + user.password_hash + '\', \'' + user.enable + '\', \'' + user.person_id + '\');';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Удалить пользователя
db.delUser = function (userID, cb) {
    var query = 'DELETE FROM users WHERE user_id = ' + userID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};


/*====================================================== Персоны =====================================================*/

// Получить список персон
db.getPersons = function (cb) {
    var query = 'SELECT\
        *,\
        trim(BOTH FROM persons.surname || \' \' || persons.name || \' \' || persons.patronymic) AS full_snp\
    FROM persons\
    ORDER BY persons.surname;';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var persons = JSON.stringify(res.rows);
            persons = JSON.parse(persons);
            cb(false, persons);
        }
    });
};

// Получить персону по ее ID
db.getPerson = function (personID, cb) {
    if (personID) {
        var query = 'SELECT\
            *,\
            trim(BOTH FROM persons.surname || \' \' || persons.name || \' \' || persons.patronymic) AS full_snp\
        FROM persons\
        WHERE persons.person_id = ' + personID + ';';
        db.query(query, function (err, res) {
            if (err)
                cb(err);
            else {
                var person = JSON.stringify(res.rows[0]);
                person = JSON.parse(person);
                cb(false, person);
            }
        });
    }
    else
        cb(true);
};

// Получить персону по userID
db.getPersonByUserID = function (userID, cb) {
    var query = 'SELECT *,\
        trim(BOTH FROM p.surname || \' \' || p.name || \' \' || p.patronymic) AS full_snp\
     FROM users\
        INNER JOIN persons p ON users.person_id = p.person_id\
        WHERE users.user_id = ' + userID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(undefined);
        else {
            var person = JSON.stringify(res.rows[0]);
            person = JSON.parse(person);
            cb(person);
        }
    });
};

// Добавить персону
db.addPerson = function (person, cb) {
    var query = 'INSERT INTO persons (surname, name, patronymic) VALUES (\'' + person.surname + '\', \'' + person.name + '\', \'' + person.patronymic + '\');';
    db.query(query, function (err, res) {
        cb(err);
    });
};

// Удалить персону
db.delPerson = function (personID, cb) {
    var query = 'DELETE FROM persons WHERE person_id = ' + personID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};


/*==================================================== Организации ===================================================*/

// Получить список организаций
db.getOrganizations = function (cb) {
    var query = 'SELECT * FROM organizations ORDER BY organizations.name;';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var organizations = JSON.stringify(res.rows);
            organizations = JSON.parse(organizations);
            cb(false, organizations);
        }
    });
};

// Получить список организаций в которых состоит человек по его ID
db.getPersonOrganizations = function (personID, cb) {
    var query = 'SELECT * FROM organizations\
          INNER JOIN persons_organizations po ON organizations.organization_id = po.organization_id\
        WHERE\
          po.person_id = ' + personID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var organizations = JSON.stringify(res.rows);
            organizations = JSON.parse(organizations);
            cb(false, organizations);
        }
    });
};

// Получить организацию по ее ID
db.getOrganization = function (organizationID, cb) {
    if (organizationID) {
        var query = 'SELECT * FROM organizations WHERE organization_id = ' + organizationID + ';';
        db.query(query, function (err, res) {
            if (err)
                cb(err);
            else {
                var organization = JSON.stringify(res.rows[0]);
                organization = JSON.parse(organization);
                cb(false, organization);
            }
        });
    }
    else
        cb(true);
};

// Добавить организацию
db.addOrganization = function (organization, cb) {
    var query = 'INSERT INTO organizations (name, full_name)\
        VALUES (\'' + organization.name + '\', \'' + organization.full_name + '\');';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Обновить организацию
db.updateOrganization = function (organization, cb) {
    var query = 'UPDATE organizations SET name = \'' + organization.name + '\', full_name = \'' + organization.full_name + '\' WHERE organization_id = ' + organization.organization_id + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Удалить организацию
db.delOrganization = function (organizationID, cb) {
    var query = 'DELETE FROM organizations WHERE organization_id = ' + organizationID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};

db.addPersonToOrganization = function (personID, organizationID, cb) {
    var query = 'INSERT INTO persons_organizations (person_id, organization_id) VALUES (\'' + personID + '\', \'' + organizationID + '\');';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Удалить человека из организации
db.delPersonFromOrganization = function (personID, organizationID, cb) {
    var query = 'DELETE FROM persons_organizations WHERE person_id = ' + personID + ' AND organization_id = ' + organizationID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};


/*======================================================= Точки ======================================================*/

// Получить список всех точек
db.getPoints = function (cb) {
    var query = 'SELECT *, trim(BOTH FROM s2.state_name || \', \' || l.locality_short_type || \' \' || points.locality_name || \', \' || points.address) AS full_address\
        FROM points\
        INNER JOIN localities l ON points.locality_id = l.locality_id\
        INNER JOIN states s2 ON points.state_id = s2.state_id';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var points = JSON.stringify(res.rows);
            points = JSON.parse(points);
            cb(false, points);
        }
    });
};

// Получить список точек организации по ее ID
db.getOrganizationPoints = function (organizationID, cb) {
    var query = 'SELECT *, trim(BOTH FROM s2.state_name || \', \' || l.locality_short_type || \' \' || points.locality_name || \', \' || points.address) AS full_address\
        FROM points\
        INNER JOIN localities l ON points.locality_id = l.locality_id\
        INNER JOIN states s2 ON points.state_id = s2.state_id\
        WHERE points.organization_id = ' + organizationID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var points = JSON.stringify(res.rows);
            points = JSON.parse(points);
            cb(false, points);
        }
    });
};

// Получить точку по ее ID
db.getPoint = function (pointID, cb) {
    var query = 'SELECT *, points.name AS name, trim(BOTH FROM s2.state_name || \', \' || l.locality_short_type || \' \' || points.locality_name || \', \' || points.address) AS full_address, o.name AS organization_name\
    FROM points\
    INNER JOIN localities l ON points.locality_id = l.locality_id\
    INNER JOIN states s2 ON points.state_id = s2.state_id\
    INNER JOIN organizations o ON points.organization_id = o.organization_id\
    WHERE points.point_id = ' + pointID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var point = JSON.stringify(res.rows[0]);
            point = JSON.parse(point);
            cb(false, point);
        }
    });
};

// Добавить точку
db.addPoint = function (point, cb) {
    if (!point.notes)
        point.notes = '';
    var query = 'INSERT INTO points (organization_id, name, state_id, locality_id, locality_name, address, notes)\
        VALUES (' + point.organization_id + ', \'' + point.name + '\', ' + point.state_id + ', ' + point.locality_id + ', \'' + point.locality_name + '\', \'' + point.address + '\', \'' + point.notes + '\');';
    db.query(query, function (err, res) {
        cb(err);
    });
};

// Обновить точку
db.updatePoint = function (point, cb) {
    var query = 'UPDATE points SET \
            name = \'' + point.name + '\', \
            state_id = ' + point.state_id + ', \
            locality_id = ' + point.locality_id + ', \
            locality_name = \'' + point.locality_name + '\', \
            address = \'' + point.address + '\', \
            notes = \'' + point.notes + '\' \
        WHERE point_id = ' + point.point_id + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            cb(false);
        }
    });
};

// Удалить точку
db.delPoint = function (pointID, cb) {
    var query = 'DELETE FROM points WHERE point_id = ' + pointID + ';';
    db.query(query, function (err, res) {
        cb(err);
    });
};


/*================================================== История заявки ==================================================*/
// Добавить событие
db.addEventToHistory = function(ticketID, creatorPersonID, eventID, description, cb) {
    if (ticketID && creatorPersonID && description) {
        var query = 'INSERT INTO tickets_history (ticket_id, creator_person_id, event_id, event_description)\
            VALUES (' + ticketID + ', ' + creatorPersonID + ', ' + eventID + ', \'' + description + '\');';
        db.query(query, function (err, res) {
            cb(err);
        });
    }
    else {
        log.error('Неправильные параметры команды addEventToHistory');
        cb(true);
    }
};


/*====================================================== Заявки ======================================================*/

// Получить список заявок
db.getTickets = function (userID, cb) {
    db.getUserPermissions(userID, function (permissions) {
        var query = 'SELECT\
            tickets.ticket_id,\
            o1.organization_id AS load_organization_id,\
            o1.name AS load_organization_name,\
            o1.full_name AS load_organization_full_name,\
            o2.organization_id AS unload_organization_id,\
            o2.name AS unload_organization_name,\
            o2.full_name AS unload_organization_full_name,\
            p1.point_id AS load_point_id,\
            p1.name AS load_point_name,\
            p1.state_id AS load_point_state_id,\
            s1.state_name AS load_point_state_name,\
            p1.locality_id AS load_point_locality_id,\
            lo1.locality_type AS load_point_locality_type,\
            lo1.locality_short_type AS load_point_locality_short_type,\
            p1.locality_name AS load_point_locality_name,\
            p1.address AS load_point_address,\
            trim(BOTH FROM s1.state_name || \', \' || lo1.locality_short_type || \' \' || p1.locality_name || \', \' || p1.address) AS load_point_full_address,\
            p1.notes AS load_point_notes,\
            p2.point_id AS unload_point_id,\
            p2.name AS unload_point_name,\
            p2.state_id AS unload_point_state_id,\
            s2.state_name AS unload_point_state_name,\
            p2.locality_id AS unload_point_locality_id,\
            lo2.locality_type AS unload_point_locality_type,\
            lo2.locality_short_type AS unload_point_locality_short_type,\
            p2.locality_name AS unload_point_locality_name,\
            p2.address AS unload_point_address,\
            trim(BOTH FROM s2.state_name || \', \' || lo2.locality_short_type || \' \' || p2.locality_name || \', \' || p2.address) AS unload_point_full_address,\
            p2.notes AS unload_point_notes,\
            tickets.weight,\
            tickets.volume,\
            tickets.load_type_id,\
            lt.load_type_name,\
            tickets.notes,\
            tickets.creator_person_id,\
            tickets.logist_person_id,\
            tickets.creation_datetime,\
            tickets.status_id,\
            ts.ticket_status_name AS status_name\
            FROM tickets\
            INNER JOIN organizations o1 ON tickets.load_organization_id = o1.organization_id\
            INNER JOIN organizations o2 ON tickets.unload_organization_id = o2.organization_id\
            INNER JOIN points p1 ON tickets.load_point_id = p1.point_id\
            INNER JOIN points p2 ON tickets.unload_point_id = p2.point_id\
            INNER JOIN states s1 ON p1.state_id = s1.state_id\
            INNER JOIN states s2 ON p2.state_id = s2.state_id\
            INNER JOIN localities lo1 ON p1.locality_id = lo1.locality_id\
            INNER JOIN localities lo2 ON p2.locality_id = lo2.locality_id\
            INNER JOIN tickets_statuses ts ON tickets.status_id = ts.ticket_status_id\
            INNER JOIN load_types lt ON tickets.load_type_id = lt.load_type_id ';
        var arr = permissions.filter(function (item) {
            return item.name === 'viewAllTickets';
        });
        if (arr.length > 0) {
            query = query + ' WHERE tickets.status_id < 5 ORDER BY tickets.creation_datetime DESC;';
        }
        else {
            arr = permissions.filter(function (item) {
                return item.name === 'viewOrganizationTickets';
            });
            if (arr.length > 0) {
                query = query + ' INNER JOIN persons cr ON tickets.creator_person_id = cr.person_id\
                    INNER JOIN persons_organizations cro ON cr.person_id = cro.person_id\
                    INNER JOIN (SELECT po.organization_id FROM users\
                      INNER JOIN persons p ON users.person_id = p.person_id\
                      INNER JOIN persons_organizations po ON p.person_id = po.person_id\
                    WHERE user_id = ' + userID + ') uso ON cro.organization_id = uso.organization_id\
                    WHERE tickets.status_id < 5\
                    ORDER BY tickets.creation_datetime DESC;';
            }
            else {
                query = query + ' INNER JOIN persons p ON tickets.creator_person_id = p.person_id\
                    INNER JOIN users u ON p.person_id = u.person_id\
                    WHERE u.user_id = ' + userID + ' AND tickets.status_id < 5\
                    ORDER BY tickets.creation_datetime DESC;';
            }
        }
        db.query(query, function (err, res) {
            if (err)
                cb(err);
            else {
                var tickets = JSON.stringify(res.rows);
                tickets = JSON.parse(tickets);
                cb(false, tickets);
            }
        });
    });
};

// Получить заявку по ее ID
db.getTicket = function (ticketID, cb) {
    var query = 'SELECT\
            tickets.ticket_id,\
            o1.organization_id AS load_organization_id,\
            o1.name AS load_organization_name,\
            o1.full_name AS load_organization_full_name,\
            o2.organization_id AS unload_organization_id,\
            o2.name AS unload_organization_name,\
            o2.full_name AS unload_organization_full_name,\
            p1.point_id AS load_point_id,\
            p1.name AS load_point_name,\
            p1.state_id AS load_point_state_id,\
            s1.state_name AS load_point_state_name,\
            p1.locality_id AS load_point_locality_id,\
            lo1.locality_type AS load_point_locality_type,\
            lo1.locality_short_type AS load_point_locality_short_type,\
            p1.locality_name AS load_point_locality_name,\
            p1.address AS load_point_address,\
            trim(BOTH FROM s1.state_name || \', \' || lo1.locality_short_type || \' \' || p1.locality_name || \', \' || p1.address) AS load_point_full_address,\
            p1.notes AS load_point_notes,\
            p2.point_id AS unload_point_id,\
            p2.name AS unload_point_name,\
            p2.state_id AS unload_point_state_id,\
            s2.state_name AS unload_point_state_name,\
            p2.locality_id AS unload_point_locality_id,\
            lo2.locality_type AS unload_point_locality_type,\
            lo2.locality_short_type AS unload_point_locality_short_type,\
            p2.locality_name AS unload_point_locality_name,\
            p2.address AS unload_point_address,\
            trim(BOTH FROM s2.state_name || \', \' || lo2.locality_short_type || \' \' || p2.locality_name || \', \' || p2.address) AS unload_point_full_address,\
            p2.notes AS unload_point_notes,\
            tickets.weight,\
            tickets.volume,\
            tickets.load_type_id,\
            lt.load_type_name,\
            tickets.notes,\
            tickets.creator_person_id,\
            tickets.logist_person_id,\
            tickets.creation_datetime,\
            tickets.status_id,\
            ts.ticket_status_name AS status_name\
        FROM tickets\
        INNER JOIN organizations o1 ON tickets.load_organization_id = o1.organization_id\
        INNER JOIN organizations o2 ON tickets.unload_organization_id = o2.organization_id\
        INNER JOIN points p1 ON tickets.load_point_id = p1.point_id\
        INNER JOIN points p2 ON tickets.unload_point_id = p2.point_id\
        INNER JOIN states s1 ON p1.state_id = s1.state_id\
        INNER JOIN states s2 ON p2.state_id = s2.state_id\
        INNER JOIN localities lo1 ON p1.locality_id = lo1.locality_id\
        INNER JOIN localities lo2 ON p2.locality_id = lo2.locality_id\
        INNER JOIN tickets_statuses ts ON tickets.status_id = ts.ticket_status_id\
        INNER JOIN load_types lt ON tickets.load_type_id = lt.load_type_id\
        WHERE tickets.ticket_id = ' + ticketID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var ticket = JSON.stringify(res.rows[0]);
            ticket = JSON.parse(ticket);
            cb(false, ticket);
        }
    });
};


// Добавить заявку
db.addTicket = function (ticket, personID, cb) {
    if (!ticket.notes)
        ticket.notes = '';
    if (!ticket.volume)
        ticket.volume = 0;
    var query = 'INSERT INTO tickets (load_organization_id, load_point_id, unload_organization_id, unload_point_id, weight, volume, creator_person_id, notes, load_type_id)\
    VALUES (' + ticket.load_organization_id + ', ' + ticket.load_point_id + ', ' + ticket.unload_organization_id + ', ' + ticket.unload_point_id + ', ' +
        ticket.weight + ', ' + ticket.volume + ', ' + personID + ', \'' + ticket.notes + '\',' + ticket.load_type_id + ');';
    db.query(query, function (err, res) {
        cb(err);
        if (err)
            cb(err);
        else {
            console.log(res);
            // Запись в журнал
            //db.addEventToHistory(ticket.ticketID)
        }
    });
};

// Функция отклонения заяввки
db.rejectTicketFunc = function (user, ticketID, description, cb) {
    // Отклонение заявки
    var query = 'UPDATE tickets SET status_id = 6 WHERE ticket_id = ' + ticketID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            // Запись события в журнал
            db.getPersonByUserID(user.user_id, function (person) {
                if (person) {
                    db.addEventToHistory(ticketID, person.person_id, 100, 'Отклонение заявки. Причина отклонения: ' + description, function (err) {
                        cb(err);
                    });
                }
                else
                    cb(true);
            });
        }
    });
};

// Взять заявку
db.takeTicket = function (user, ticketID, cb) {
    db.getPersonByUserID(user.user_id, function (person) {
        if (person) {
            // Взятие заявки
            var query = 'UPDATE tickets SET status_id = 2, logist_person_id = ' + person.person_id + ' WHERE ticket_id = ' + ticketID + ';';
            db.query(query, function (err, res) {
                if (err)
                    cb(err);
                else {
                    // Запись события в журнал
                    db.addEventToHistory(ticketID, person.person_id, 10, 'Заявка переведена в статус "В работе": ' + person.full_snp, function (err) {
                        cb(err);
                    });
                }
            });
        }
        else
            cb(true);
    });
};


// Отклонить заявку
db.rejectTicket = function (user, ticketID, description, cb) {
    // Проверка прав на отклонение всех заявок
    var query = 'SELECT COUNT(*)\
        FROM users u\
          INNER JOIN users_groups ug ON u.user_id = ug.user_id\
          INNER JOIN groups_permissions gp ON ug.group_id = gp.group_id\
          INNER JOIN permissions p ON gp.permission_id = p.permission_id\
        WHERE u.user_id = ' + user.user_id + ' AND p.name = \'rejectAllTickets\';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            if (res.rows[0].count === '1') {
                log.debug('Отклонение заявки на основе права отклонения всех заявок');
                db.rejectTicketFunc(user, ticketID, description, function (err) {
                    if (err)
                        cb(err);
                    else
                        cb(false);
                });
            }
            else {
                // Проверка прав на отклонение заявки организации
                query = 'SELECT COUNT(*)\
                    FROM users u\
                      INNER JOIN persons p ON u.person_id = p.person_id\
                      INNER JOIN persons_organizations po ON p.person_id = po.person_id\
                      INNER JOIN (SELECT po.organization_id\
                        FROM tickets t\
                          INNER JOIN persons p ON t.creator_person_id = p.person_id\
                          INNER JOIN persons_organizations po ON p.person_id = po.person_id\
                        WHERE t.ticket_id = ' + ticketID + ') to1 ON to1.organization_id = po.organization_id\
                      INNER JOIN users_groups ug ON u.user_id = ug.user_id\
                      INNER JOIN groups_permissions gp ON ug.group_id = gp.group_id\
                      INNER JOIN permissions p2 ON gp.permission_id = p2.permission_id\
                    WHERE u.user_id = ' + user.userr_id + ' AND p.name = \'rejectOrganizationTickets\';';
                db.query(query, function (err, res) {
                    if (res.rows[0].count === '1') {
                        log.debug('Отклонение заявки на основе права отклонения заявок организации');
                        db.rejectTicketFunc(user, ticketID, description, function (err) {
                            if (err)
                                cb(err);
                            else
                                cb(false);
                        });
                    }
                    else
                        cb(false);
                })
            }
        }
    });
};

//
db.planTicket = function (user, ticketID, cb) {
    db.getPersonByUserID(user.user_id, function (person) {
        if (person) {
            // Взятие заявки
            var query = 'UPDATE tickets SET status_id = 3, logist_person_id = ' + person.person_id + ' WHERE ticket_id = ' + ticketID + ';';
            db.query(query, function (err, res) {
                if (err)
                    cb(err);
                else {
                    // Запись события в журнал
                    db.addEventToHistory(ticketID, person.person_id, 10, 'Заявка переведена в статус "Запланирована": ' + person.full_snp, function (err) {
                        cb(err);
                    });
                }
            });
        }
        else
            cb(true);
    });
};

// Перевести заявку в статус "В пути"
db.onWayTicket = function (user, ticketID, cb) {
    db.getPersonByUserID(user.user_id, function (person) {
        if (person) {
            // Взятие заявки
            var query = 'UPDATE tickets SET status_id = 4, logist_person_id = ' + person.person_id + ' WHERE ticket_id = ' + ticketID + ';';
            db.query(query, function (err, res) {
                if (err)
                    cb(err);
                else {
                    // Запись события в журнал
                    db.addEventToHistory(ticketID, person.person_id, 10, 'Заявка переведена в статус "В пути": ' + person.full_snp, function (err) {
                        cb(err);
                    });
                }
            });
        }
        else
            cb(true);
    });
};

// Закрыть заявку
db.closeTicket = function (user, data, cb) {
    db.getPersonByUserID(user.user_id, function (person) {
        if (person) {
            // Взятие заявки
            console.log('===============', data, '=============================');
            var query = 'UPDATE tickets SET status_id = 5, logist_person_id = ' + person.person_id + ', closed_cost = ' + data.closed_cost + ' WHERE ticket_id = ' + data.ticket_id + ';';
            db.query(query, function (err, res) {
                if (err)
                    cb(err);
                else {
                    // Запись события в журнал
                    db.addEventToHistory(data.ticket_id, person.person_id, 10, 'Заявка переведена в статус "Закрыта": ' + person.full_snp, function (err) {
                        cb(err);
                    });
                }
            });
        }
        else
            cb(true);
    });
};



/*================================================== Архивные заявки =================================================*/

// Получить список заявок согласно правам доступа
db.getAchiveTickets = function (userID, cb) {
    db.getUserPermissions(userID, function (permissions) {
        var query = 'SELECT\
            tickets.ticket_id,\
            o1.organization_id AS load_organization_id,\
            o1.name AS load_organization_name,\
            o1.full_name AS load_organization_full_name,\
            o2.organization_id AS unload_organization_id,\
            o2.name AS unload_organization_name,\
            o2.full_name AS unload_organization_full_name,\
            p1.point_id AS load_point_id,\
            p1.name AS load_point_name,\
            p1.state_id AS load_point_state_id,\
            s1.state_name AS load_point_state_name,\
            p1.locality_id AS load_point_locality_id,\
            lo1.locality_type AS load_point_locality_type,\
            lo1.locality_short_type AS load_point_locality_short_type,\
            p1.locality_name AS load_point_locality_name,\
            p1.address AS load_point_address,\
            trim(BOTH FROM s1.state_name || \', \' || lo1.locality_short_type || \' \' || p1.locality_name || \', \' || p1.address) AS load_point_full_address,\
            p1.notes AS load_point_notes,\
            p2.point_id AS unload_point_id,\
            p2.name AS unload_point_name,\
            p2.state_id AS unload_point_state_id,\
            s2.state_name AS unload_point_state_name,\
            p2.locality_id AS unload_point_locality_id,\
            lo2.locality_type AS unload_point_locality_type,\
            lo2.locality_short_type AS unload_point_locality_short_type,\
            p2.locality_name AS unload_point_locality_name,\
            p2.address AS unload_point_address,\
            trim(BOTH FROM s2.state_name || \', \' || lo2.locality_short_type || \' \' || p2.locality_name || \', \' || p2.address) AS unload_point_full_address,\
            p2.notes AS unload_point_notes,\
            tickets.weight,\
            tickets.volume,\
            tickets.load_type_id,\
            lt.load_type_name,\
            tickets.notes,\
            tickets.creator_person_id,\
            tickets.logist_person_id,\
            tickets.creation_datetime,\
            tickets.status_id,\
            ts.ticket_status_name AS status_name\
            FROM tickets\
            INNER JOIN organizations o1 ON tickets.load_organization_id = o1.organization_id\
            INNER JOIN organizations o2 ON tickets.unload_organization_id = o2.organization_id\
            INNER JOIN points p1 ON tickets.load_point_id = p1.point_id\
            INNER JOIN points p2 ON tickets.unload_point_id = p2.point_id\
            INNER JOIN states s1 ON p1.state_id = s1.state_id\
            INNER JOIN states s2 ON p2.state_id = s2.state_id\
            INNER JOIN localities lo1 ON p1.locality_id = lo1.locality_id\
            INNER JOIN localities lo2 ON p2.locality_id = lo2.locality_id\
            INNER JOIN tickets_statuses ts ON tickets.status_id = ts.ticket_status_id\
            INNER JOIN load_types lt ON tickets.load_type_id = lt.load_type_id ';
        var arr = permissions.filter(function (item) {
            return item.name === 'viewAllTickets';
        });
        if (arr.length > 0) {
            query = query + ' WHERE tickets.status_id > 4 ORDER BY tickets.creation_datetime DESC;';
        }
        else {
            arr = permissions.filter(function (item) {
                return item.name === 'viewOrganizationTickets';
            });
            if (arr.length > 0) {
                query = query + ' INNER JOIN persons cr ON tickets.creator_person_id = cr.person_id\
                    INNER JOIN persons_organizations cro ON cr.person_id = cro.person_id\
                    INNER JOIN (SELECT po.organization_id FROM users\
                      INNER JOIN persons p ON users.person_id = p.person_id\
                      INNER JOIN persons_organizations po ON p.person_id = po.person_id\
                    WHERE user_id = ' + userID + ') uso ON cro.organization_id = uso.organization_id\
                    WHERE tickets.status_id > 4\
                    ORDER BY tickets.creation_datetime DESC;';
            }
            else {
                query = query + ' INNER JOIN persons p ON tickets.creator_person_id = p.person_id\
                    INNER JOIN users u ON p.person_id = u.person_id\
                    WHERE u.user_id = ' + userID + ' AND tickets.status_id > 4\
                    ORDER BY tickets.creation_datetime DESC;';
            }
        }
        db.query(query, function (err, res) {
            if (err)
                cb(err);
            else {
                var tickets = JSON.stringify(res.rows);
                tickets = JSON.parse(tickets);
                cb(false, tickets);
            }
        });
    });
};


/*================================================== История заявок ==================================================*/

// Получить историю заявки по ее ID
db.getTicketHistory = function (ticketID, cb) {
    var query = 'SELECT * FROM tickets_history WHERE ticket_id = ' + ticketID + ';';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            var ticketHistory = JSON.stringify(res.rows);
            ticketHistory = JSON.parse(ticketHistory);
            cb(false, ticketHistory);
        }
    });
};


/*====================================================== Отчеты ======================================================*/
db.getReport_dayReport = function (date, cb) {
    var moDate = moment(date, 'DD.MM.YYYY').format('YYYY-MM-DD');
    var query = 'SELECT p.person_id,\
           p.surname,\
           p.name,\
           p.patronymic,\
           tmp.organization_id,\
           tmp.organization_name,\
           tmp.weight_sum,\
           tmp.volume_sum,\
           tmp.count_ttl\
    FROM (\
    SELECT t.creator_person_id,\
           o.name AS organization_name,\
            o.organization_id,\
           COUNT(t.creator_person_id) AS count_ttl,\
           SUM(t.weight)              AS weight_sum,\
           SUM(volume)                AS volume_sum\
    FROM tickets AS t\
             LEFT JOIN persons_organizations AS po ON t.creator_person_id = po.person_id\
             LEFT JOIN organizations AS o ON po.organization_id = o.organization_id\
    WHERE t.status_id IN (1, 2)\
      AND t.creation_datetime < \'' + moDate + ' 23:59:59 +3:00\'\
    GROUP BY (t.creator_person_id, o.name, o.organization_id) ) AS tmp\
    JOIN persons AS p ON tmp.creator_person_id = p.person_id';
    db.query(query, function (err, res) {
        if (err)
            cb(err);
        else {
            // Нормализация данных
            res = JSON.stringify(res.rows);
            res = JSON.parse(res);

            // Обработка данных
            var orgs = {};
            for (var i = 0; i < res.length; i++) {
                var org = Object.assign(res[i], {});

                var id = org.organization_id;

                if (id == null) {
                    org.organization_id = 0;
                    org.organization_name = '<Не определено>';
                }

                if (!orgs[id]) {
                    orgs[id] = {
                        organization_id: id,
                        organization_name: org.organization_name,
                        visible: false,
                        weight_sum: 0,
                        volume_sum: 0,
                        count_ttl: 0,
                        mans: []
                    };
                }
                orgs[id].mans.push(org);
                orgs[id].weight_sum += parseInt(org.weight_sum);
                orgs[id].volume_sum += parseInt(org.volume_sum);
                orgs[id].count_ttl += parseInt(org.count_ttl);
            }

            cb(false, orgs);
        }
    });
};


db.getReport_periodReport = function (data, cb) {

    //TODO: добавить проверки на корректность дат (или на клиенте)

    let moBegDate = moment(data.date, 'DD.MM.YYYY').format('YYYY-MM-DD');
    let moEndDate = moment(data.dateEnd, 'DD.MM.YYYY').format('YYYY-MM-DD');
    let useAchive = data.parameters.isNeedUseArchive;

    var query2 =
'SELECT \t\n' +
        '\tloadpointState.loadpointState_name,\n' +
        '\tloadpointLocalities.localitiesLocalityShort_type,\n' +
        '\tloadpoint.loadpoint_localityname,\n' +
        '\tunloadpointState.unloadpointState_name,\n' +
        '\tunloadpointLocalities.unlocalitiesLocalityShort_type,\n' +
        '\tunloadpoint.unloadpoint_localityname,\n' +
        '\tticketsStatuses.ticketsStatusesStatus_name,\n' +
        '\tloadCompany.loadCompany_name,\n' +
        '\tunloadCompany.unloadCompany_name,\n' +
        '\tlogistPerson.logistPerson_surname,\n' +
        '\tlogistPerson.logistPerson_name,\n' +
        '\tlogistPerson.logistPerson_patronymic,\n' +
        '\tt.weight\n' +
        '\tFROM tickets AS t\n' +
        '\t\t\t /*следующие 3 join подгружают местоположение места погрузки*/\n' +
        '\t\t\t left join (\n' +
        '\t\t\t /* выборка региона погрузки */\n' +
        '\t\t\t\t select \n' +
        '\t\t\t\t \tpoints.point_id as loadpoint_id,\n' +
        '\t\t\t\t \tpoints.state_id as loadpoint_stateid,\n' +
        '\t\t\t\t \tpoints.locality_id as loadpoint_localityid,\n' +
        '\t\t\t\t \tpoints.locality_name as loadpoint_localityname\n' +
        '\t\t\t\t from points\n' +
        '\t\t\t ) as loadpoint on t.load_point_id = loadpoint_id\n' +
        '\t\t\t /* подгружаем наименование региона */\n' +
        '\t\t\t left join (\n' +
        '\t\t\t\t select\n' +
        '\t\t\t\t \tstates.state_id as loadpointState_id,\n' +
        '\t\t\t\t \tstates.state_name as loadpointState_name\n' +
        '\t\t\t\t from\n' +
        '\t\t\t\t \tstates\n' +
        '\t\t\t ) as loadpointState on loadpoint_stateid = loadpointState_id\n' +
        '\t\t\t /* подгружаем наименование места - город, поселок и т.д. */\n' +
        '\t\t\t left join(\n' +
        '\t\t\t \tselect\n' +
        '\t\t\t\t\tlocalities.locality_id as localitiesLocality_id,\n' +
        '\t\t\t\t \tlocalities.locality_short_type as localitiesLocalityShort_type\n' +
        '\t\t\t\tfrom\n' +
        '\t\t\t\t \tlocalities\n' +
        '\t\t\t ) as loadpointLocalities on loadpoint_localityid = localitiesLocality_id\n' +
        '\t\t\t/*следующие 3 join подгружают местоположение места выгрузки*/\n' +
        '\t\t\t left join (\n' +
        '\t\t\t /* выборка региона погрузки */\n' +
        '\t\t\t\t select \n' +
        '\t\t\t\t \tpoints.point_id as unloadpoint_id,\n' +
        '\t\t\t\t \tpoints.state_id as unloadpoint_stateid,\n' +
        '\t\t\t\t \tpoints.locality_id as unloadpoint_localityid,\n' +
        '\t\t\t\t \tpoints.locality_name as unloadpoint_localityname\n' +
        '\t\t\t\t from points\n' +
        '\t\t\t ) as unloadpoint on t.unload_point_id = unloadpoint_id\n' +
        '\t\t\t /* подгружаем наименование региона */\n' +
        '\t\t\t left join (\n' +
        '\t\t\t\t select\n' +
        '\t\t\t\t \tstates.state_id as unloadpointState_id,\n' +
        '\t\t\t\t \tstates.state_name as unloadpointState_name\n' +
        '\t\t\t\t from\n' +
        '\t\t\t\t \tstates\n' +
        '\t\t\t ) as unloadpointState on unloadpoint_stateid = unloadpointState_id\n' +
        '\t\t\t /* подгружаем наименование места - город, поселок и т.д. */\n' +
        '\t\t\t left join(\n' +
        '\t\t\t \tselect\n' +
        '\t\t\t\t\tlocalities.locality_id as unlocalitiesLocality_id,\n' +
        '\t\t\t\t \tlocalities.locality_short_type as unlocalitiesLocalityShort_type\n' +
        '\t\t\t\tfrom\n' +
        '\t\t\t\t \tlocalities\n' +
        '\t\t\t ) as unloadpointLocalities on unloadpoint_localityid = unlocalitiesLocality_id\n' +
        '\t\t\t /* подгружаем словесное описание статуса заявки */\n' +
        '\t\t\t left join(\n' +
        '\t\t\t \tselect\n' +
        '\t\t\t\t\ttickets_statuses.ticket_status_id as ticketsStatusesStatus_id,\n' +
        '\t\t\t\t \ttickets_statuses.ticket_status_name as ticketsStatusesStatus_name\n' +
        '\t\t\t\tfrom tickets_statuses\n' +
        '\t\t\t ) as ticketsStatuses on t.status_id = ticketsStatusesStatus_id\n' +
        '\t\t\t /* подгружаем название компании - погрузка */\n' +
        '\t\t\t left join(\n' +
        '\t\t\t \tselect \n' +
        '\t\t\t\t\torganizations.organization_id as loadCompany_id,\n' +
        '\t\t\t\t \torganizations.name as loadCompany_name\n' +
        '\t\t\t\tfrom organizations\n' +
        '\t\t\t ) as loadCompany on t.load_organization_id = loadCompany_id\n' +
        '\t\t\t /* подгружаем название компании - выгрузка */\n' +
        '\t\t\t left join(\n' +
        '\t\t\t \tselect \n' +
        '\t\t\t\t\torganizations.organization_id as unloadCompany_id,\n' +
        '\t\t\t\t \torganizations.name as unloadCompany_name\n' +
        '\t\t\t\tfrom organizations\n' +
        '\t\t\t ) as unloadCompany on t.unload_organization_id = unloadCompany_id\n' +
        '\t\t\t /* подгружаем имя логиста */\n' +
        '\t\t\t left join(\n' +
        '\t\t\t\t select\n' +
        '\t\t\t\t \tpersons.person_id as logistPerson_id,\n' +
        '\t\t\t\t \tpersons.name as logistPerson_name,\n' +
        '\t\t\t\t \tpersons.surname as logistPerson_surname,\n' +
        '\t\t\t\t \tpersons.patronymic as logistPerson_patronymic\n' +
        '\t\t\t\t from persons\n' +
        '\t\t\t ) as logistPerson on t.logist_person_id = logistPerson_id\n' +
        (useAchive ? 'WHERE' : 'WHERE t.status_id IN (1,2,3,4) AND') +
        //'    WHERE t.status_id IN (1, 2)\n' +
        '      t.creation_datetime > \'' + moBegDate + ' 00:00:00 +3:00\'\n' +
        '      AND t.creation_datetime < \'' + moEndDate + ' 23:59:59 +3:00\''



    var query = 'SELECT p.person_id,\
           p.surname,\
           p.name,\
           p.patronymic,\
           tmp.organization_id,\
           tmp.organization_name,\
           tmp.weight_sum,\
           tmp.volume_sum,\
           tmp.count_ttl\
    FROM (\
    SELECT t.creator_person_id,\
           o.name AS organization_name,\
            o.organization_id,\
           COUNT(t.creator_person_id) AS count_ttl,\
           SUM(t.weight)              AS weight_sum,\
           SUM(volume)                AS volume_sum\
    FROM tickets AS t\
             LEFT JOIN persons_organizations AS po ON t.creator_person_id = po.person_id\
             LEFT JOIN organizations AS o ON po.organization_id = o.organization_id\
    WHERE t.status_id IN (1, 2)\
      AND t.creation_datetime > \'' + moBegDate + ' 00:00:00 +3:00\'\
      AND t.creation_datetime < \'' + moEndDate + ' 23:59:59 +3:00\'\
    GROUP BY (t.creator_person_id, o.name, o.organization_id) ) AS tmp\
    JOIN persons AS p ON tmp.creator_person_id = p.person_id';


    db.query(query2, function (err, res) {
        if (err)
            cb(err);
        else {
            // Нормализация данных
            res = JSON.stringify(res.rows);
            res = JSON.parse(res);

            // Обработка данных
            var tickets = [];
            for (var i = 0; i < res.length; i++) {
                var ticket = Object.assign(res[i], {});

                tickets.push(ticket);
                // var id = org.organization_id;
                //
                // if (id == null) {
                //     org.organization_id = 0;
                //     org.organization_name = '<Не определено>';
                // }
                //
                // if (!orgs[id]) {
                //     orgs[id] = {
                //         organization_id: id,
                //         organization_name: org.organization_name,
                //         visible: false,
                //         weight_sum: 0,
                //         volume_sum: 0,
                //         count_ttl: 0,
                //         mans: []
                //     };
                // }
                // orgs[id].mans.push(org);
                // orgs[id].weight_sum += parseInt(org.weight_sum);
                // orgs[id].volume_sum += parseInt(org.volume_sum);
                // orgs[id].count_ttl += parseInt(org.count_ttl);
            }

            cb(false, tickets);
        }
    });
};



/*====================================================== Прочее ======================================================*/

// Кеширование субъектов РФ
var query = 'SELECT * FROM states ORDER BY state_name';
db.query(query, function (err, res) {
    if (err)
        throw err;
    else {
        var states = JSON.stringify(res.rows);
        states = JSON.parse(states);
        db.states = states;
    }
});

// Получить список типов населенных пунктов
query = 'SELECT * FROM localities ORDER BY locality_type';
db.query(query, function (err, res) {
    if (err)
        throw err;
    else {
        var localities = JSON.stringify(res.rows);
        localities = JSON.parse(localities);
        db.localities = localities;
    }
});

// Получить список форм загрузки груза
query = 'SELECT * FROM load_types ORDER BY load_type_id';
db.query(query, function (err, res) {
    if (err)
        throw err;
    else {
        var loadTypes = JSON.stringify(res.rows);
        loadTypes = JSON.parse(loadTypes);
        db.loadTypes = loadTypes;
    }
});


// Создание дерева страниц с разрешениями
db.getSidebarAllPages(function (pages) {
    // Добавление типа элемента
    pages.forEach(function (page) {
        page.type = 'folder';
        page.submenu = [];
    });

    //console.log(pages);

    // Получение прав
    db.getPermissions(function (err, permissions) {
        if (err) {
            // Логирование ошибки
            log.error('Ошибка. Невозможно получить общий список разрешений.');
        }
        else {
            for (var i = 0; i < permissions.length; i++) {
                // Добавление типа элемента
                permissions[i].type = 'checkbox';
                permissions[i].checked = false;
                permissions[i].title = permissions[i].description;

                // Инкапсуляция разрешений в страницы
                for (var j = 0; j < pages.length; j++) {
                    if (pages[j].page_id === permissions[i].page_id) {
                        pages[j].submenu.push(permissions[i]);
                    }
                }
            }


            // Формирование массива боковой панели (первый уровень)
            var sidebar = pages.filter(function (page) {
                return page.menu_level === 1;
            });

            // Добавление подменю (второй уровень)
            pages.forEach(function (page) {
                if (page.menu_level === 2) {
                    sidebar.forEach(function (parentPage) {
                        if (parentPage.page_id === page.parent_page_id) {
                            parentPage.submenu.push(page);
                        }
                    });
                }
            });
            //console.log(sidebar, sidebar.length);

            db.permissionsTree = sidebar;
        }
    });
});

module.exports = db;