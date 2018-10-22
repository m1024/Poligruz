var db = require('./db');
var messages = require('./messages');
var users = require('./users');
var cookie = require('cookie');
var Logger = require('logplease');
var log = Logger.create('commands', { filename: './logs/log.log'});
var commands = {};


//todo: При рестарте сервера посылать всем клиентам logout
//todo: Проверка данных в командах. Можно положить сервер если передать неправлильные или undefined данные

var cloneObject = function (obj) {
    var res = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            res[key] = obj[key];
    }
    return res;
};


// Получение SessionID из сокета
commands.getSessionIDFromSocket = function (socket) {
    let values = cookie.parse(socket.handshake.headers.cookie);

    if (values['connect.sid'] === undefined) return undefined;
    let sessionID = values['connect.sid'].substring(0, values['connect.sid'].indexOf('.')).substring(2);
    return sessionID;
};


// Предварительная обработка команды
commands.execCommand = function (command, socket) {
    //Логирование события
    log.debug('Command: ' + command.name + '. From: ' + socket.id);

    // Проверка существования команды
    if (typeof commands.list[command.name] === 'function') {
        // Вычленение SessionID из сокета.
        var sessionID = commands.getSessionIDFromSocket(socket);

        if (sessionID === undefined){
            //Логирование события
            log.warn('Command: Session undefined: ' + command.name + '. From: ' + socket.id);
            socket.emit('delete_cookie', 'connect.sid');
            return;
        }

        // Вычленение команд "logon" и "logout" т.к. эта команда не использует проверку на доступ
        if (command.name === 'logon' || command.name === 'logout') {
            // Выполнение команды
            commands.list[command.name](command.data, socket, sessionID);
        }
        else {
            // Проверка на доступ к выполнению команды
            users.getUserBySessionID(sessionID, function (user) {
                if (user !== undefined) {
                    db.getCommandPermissions(command.name, user, function (result) {
                        if (result) {
                            //Логирование события
                            log.debug('Granted command ', command.name, ' for user', user.login);

                            // Выполнение команды
                            commands.list[command.name](command.data, command.flags, socket, sessionID);
                        }
                        else {
                            //Логирование события
                            log.debug('Denided command ', command.name, ' for user', user.login);

                            // Отправка ошибки
                            messages.sendError('Запрещенная команда: ' + command.name, socket);
                        }
                    });
                }
                else {
                    //Логирование события
                    log.debug('Denided command ', command.name, '. User is undefined.');

                    // Отправка ошибки
                    messages.sendError('Запрещенная команда: ' + command.name, socket);
                }
            });
        }
    }
    else {
        //Логирование события
        log.warn('Command not found: ' + command.name + '. From: ' + socket.id);

        // Отправка ошибки
        messages.sendError('Команда ' + command.name + ' не найдена.', socket);
    }
};

// Список команд
commands.list = {};

// Вход в систему
commands.list.logon = function (data, socket, sessionID) {
    db.getUserByLogin(data.login, data.passwordHash, function (user) {
        if (user) {
            //Логирование события
            log.debug('Logon granted for: ' + data.login + '. From: ' + socket.id);

            users.addUser(user, sessionID);

            // Пользователь существует и ему разрешен доступ
            var command = {
                name: 'logon'
            };
            messages.sendCommand(command, socket);
        }
        else {
            //Логирование события
            log.debug('Logon denided for: ' + data.login + '. From: ' + socket.id);

            // Отправка ошибки
            messages.sendError('Такие имя пользователя и пароль не найдены.', socket);
        }
    });
};

// Выход из системы
commands.list.logout = function (data, socket, sessionID) {
    // Удаление пользователя по его sessionID
    users.removeUserBySessionID(sessionID, function (res) {
        if (res) {
            // Пользователь удален
            // Отправка команды
            messages.sendCommand({name: 'logout'}, socket);
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Не удалось выполнить выход. Пользователь не найден среди авторизованных', socket);
        }
    })
};

// Получить список групп пользователей
commands.list.getUsersGroups = function (data, flags, socket, sessionID) {
    db.getUsersGroups(function (err, groups) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список групп пользователей.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getUsersGroups', groups, flags, socket);
        }
    });
};

// Получить список пользователей определенной группы пользователей
commands.list.getGroupUsers = function (data, flags, socket, sessionID) {
    db.getGroupUsers(data.groupID, function (err, users) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список пользователей группы.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getGroupUsers', users, flags, socket);
        }
    })
};

// Получить список пользователей не входящих в группу с ID
commands.list.getNotGroupUsers = function (data, flags, socket, sessionID) {
    db.getNotGroupUsers(data.groupID, function (err, users) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список пользователей не входящих в группу.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getNotGroupUsers', users, flags, socket);
        }
    })
};

// Получить группу по ее ID
commands.list.getUsersGroup = function (data, flags, socket, sessionID) {
    db.getUsersGroup(data.groupID, function (err, group) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить группу.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getUsersGroup', group, flags, socket);
        }
    });
};


// Получить дерево страниц с разрешениями
commands.list.getPermissionsTree = function (data, flags, socket, sessionID) {
    var permissionsTree = db.permissionsTree;

    // Отправка данных
    messages.sendData('getPermissionsTree', permissionsTree, flags, socket);
};

// Получить список разрешения группы пользователей
commands.list.getUsersGroupPermissions = function (data, flags, socket, sessionID) {
    db.getUsersGroupPermissions(data.groupID, function (err, permissions) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список разрешений для группы.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getUsersGroupPermissions', permissions, flags, socket);
        }
    });
};

// Добавить группу пользователей
commands.list.addUsersGroup = function (data, flags, socket, sessionID) {
    db.addUsersGroup(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно добавить группу пользователей.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Группа добавлена', socket);
            // Отправка данных
            messages.sendData('addUsersGroup', true, flags, socket);
        }
    });
};

// Изменить группу пользователей
commands.list.saveUsersGroup = function (data, flags, socket, sessionID) {
    db.saveUsersGroup(data.group, data.tree, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно изменить данные группы пользователей.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Группа изменена', socket);
            // Отправка данных
            messages.sendData('saveUsersGroup', true, flags, socket);
        }
    });
};

// Удалить группу пользователей
commands.list.delUsersGroup = function (data, flags, socket, sessionID) {
    db.delUsersGroup(data.groupID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно удалить группу пользователей.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Группа удалена', socket);
            // Отправка данных
            messages.sendData('delUsersGroup', true, flags, socket);
        }
    });
};

// Добавить пользователя в группу
commands.list.addUserToGroup = function (data, flags, socket, sessionID) {
    db.addUserToGroup(data.groupID, data.userID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно добавить пользователя в группу.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Пользователь добавлен в группу', socket);
            // Отправка данных
            messages.sendData('addUserToGroup', true, flags, socket);
        }
    });
};

// Удалить пользователя из группы
commands.list.delUserFromGroup = function (data, flags, socket, sessionID) {
    db.delUserFromGroup(data.groupID, data.userID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно удалить пользователя из группы.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Пользователь удален из группы', socket);
            // Отправка данных
            messages.sendData('delUserFromGroup', true, flags, socket);
        }
    });
};


/*=================================================== Пользователи ===================================================*/

// Получить список пользователей
commands.list.getUsers = function (data, flags, socket, sessionID) {
    db.getUsers(function (err, users) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список пользователей.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getUsers', users, flags, socket);
        }
    })
};

// Получить список групп пользователя
commands.list.getUserGroups = function (data, flags, socket, sessionID) {
    db.getUserGroups(data.userID, function (err, groups) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список групп пользователя.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getUserGroups', groups, flags, socket);
        }
    });
};

// Получить пользователя по его ID
commands.list.getUser = function (data, flags, socket, sessionID) {
    db.getUser(data.userID, function (err, user) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить пользователя.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getUser', user, flags, socket);
        }
    });
};

// Сменить пароль пользователя
commands.list.changeUserPassword = function (data, flags, socket, sessionID) {
    db.changeUserPassword(data.userID, data.passwordHash, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно изменить пароль пользователя.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Пароль пользователя изменён', socket);
        }
    });
};

// Получить список прикрепленных к человеку учетных записей по его ID
commands.list.getPersonUsers = function (data, flags, socket, sessionID) {
    db.getPersonUsers(data.personID, function (err, users) {
        if (!err) {
            // Отправка данных
            messages.sendData('getPersonUsers', users, flags, socket);
        }
    });
};

// Добавить пользователя
commands.list.addUser = function (data, flags, socket, sessionID) {
    db.addUser(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно добавить пользователя.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Пользователь добавлен', socket);
            // Отправка данных
            messages.sendData('addUser', true, flags, socket);
        }
    });
};

// Удалить пользователя
commands.list.delUser = function (data, flags, socket, sessionID) {
    db.delUser(data.userID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно удалить пользователя.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Пользователь удален', socket);
            // Отправка данных
            messages.sendData('delUser', true, flags, socket);
        }
    });
};


/*====================================================== Персоны =====================================================*/

// Получить список персон
commands.list.getPersons = function (data, flags, socket, sessionID) {
    db.getPersons(function (err, persons) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список людей.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getPersons', persons, flags, socket);
        }
    });
};

// Получить персону по ее ID
commands.list.getPerson = function (data, flags, socket, sessionID) {
    db.getPerson(data.personID, function (err, person) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные человека.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getPerson', person, flags, socket);
        }
    });
};

// Добавить персону
commands.list.addPerson = function (data, flags, socket, sessionID) {
    db.addPerson(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно добавить человека.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Человек добавлен', socket);
            // Отправка данных
            messages.sendData('addPerson', true, flags, socket);
        }
    });
};

// Удалить персону
commands.list.delPerson = function (data, flags, socket, sessionID) {
    db.delPerson(data.personID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно удалить человека.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Человек удален', socket);
            // Отправка данных
            messages.sendData('delPerson', true, flags, socket);
        }
    });
};


/*==================================================== Организации ===================================================*/

// Получить список организаций
commands.list.getOrganizations = function (data, flags, socket, sessionID) {
    db.getOrganizations(function (err, organizations) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список организаций.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getOrganizations', organizations, flags, socket);
        }
    });
};

// Получить организацию по ее ID
commands.list.getOrganization = function (data, flags, socket, sessionID) {
    db.getOrganization(data.organizationID, function (err, organization) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные организации.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getOrganization', organization, flags, socket);
        }
    });
};

// Получить список организаций в которых состоит человек по его ID
commands.list.getPersonOrganizations = function (data, flags, socket, sessionID) {
    db.getPersonOrganizations(data.personID, function (err, organizations) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список организаций человека.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getPersonOrganizations', organizations, flags, socket);
        }
    });
};

// Добавить организацию
commands.list.addOrganization = function (data, flags, socket, sessionID) {
    db.addOrganization(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно добавить организацию.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Организация добавлена', socket);
            // Отправка данных
            messages.sendData('addOrganization', true, flags, socket);
        }
    });
};

// Обновить организацию
commands.list.updateOrganization = function (data, flags, socket, sessionID) {
    db.updateOrganization(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно обновить организацию.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Информация по организации обновлена', socket);
            // Отправка данных
            messages.sendData('updateOrganization', true, flags, socket);
        }
    })
};

// Удалить организацию
commands.list.delOrganization = function (data, flags, socket, sessionID) {
    db.delOrganization(data.organizationID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно удалить организацию.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Организация удалена', socket);
            // Отправка данных
            messages.sendData('delOrganization', true, flags, socket);
        }
    });
};

// Добавить человека в организацию
commands.list.addPersonToOrganization = function (data, flags, socket, sessionID) {
    db.addPersonToOrganization(data.personID, data.organizationID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно присоединить человека к организации.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Человек присоединен к организации', socket);
            // Отправка данных
            messages.sendData('addPersonToOrganization', true, flags, socket);
        }
    });
};

// Удалить человека из организации
commands.list.delPersonFromOrganization = function (data, flags, socket, sessionID) {
    db.delPersonFromOrganization(data.personID, data.organizationID, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно удалить человека из организации.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Человек удален из организации', socket);
            // Отправка данных
            messages.sendData('delPersonFromOrganization', true, flags, socket);
        }
    });
};


/*======================================================= Точки ======================================================*/

// Получить список всех точек
commands.list.getPoints = function (data, flags, socket, sessionID) {
    db.getPoints(function (err, points) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список точек.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getPoints', points, flags, socket);
        }
    });
};

// Получить список точек организации по ее ID
commands.list.getOrganizationPoints = function (data, flags, socket, sessionID) {
    db.getOrganizationPoints(data.organizationID, function (err, points) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить список точек организации.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getOrganizationPoints', points, flags, socket);
        }
    });
};

// Получить точку по ее ID
commands.list.getPoint = function (data, flags, socket, sessionID) {
    db.getPoint(data.pointID, function (err, point) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные точки.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getPoint', point, flags, socket);
        }
    });
};

// Получить список субъектов РФ
commands.list.getStates = function (data, flags, socket, sessionID) {
    // Отправка данных
    messages.sendData('getStates', db.states, flags, socket);
};

// Получить список типов населенных пунктов
commands.list.getLocalities = function (data, flags, socket, sessionID) {
    // Отправка данных
    messages.sendData('getLocalities', db.localities, flags, socket)
};

// Добавить точку
commands.list.addPoint = function (data, flags, socket, sessionID) {
    db.addPoint(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно добавить точку.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Точка добавлена', socket);
            // Отправка данных
            messages.sendData('addPoint', true, flags, socket);
        }
    });

};

// Обновить точку
commands.list.updatePoint = function (data, flags, socket, sessionID) {
    db.updatePoint(data, function (err) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно обновить точку.', socket);
        }
        else {
            // Отправка информации
            messages.sendInfo('Информация по точке обновлена', socket);
            // Отправка данных
            messages.sendData('updatePoint', true, flags, socket);
        }
    })
},

// Удалить точку
    commands.list.delPoint = function (data, flags, socket, sessionID) {
        db.delPoint(data.pointID, function (err) {
            if (err) {
                // Отправка ошибки
                messages.sendError('Ошибка. Невозможно удалить точку', socket);
            }
            else {
                // Отправка информации
                messages.sendInfo('Точка удалена', socket);
                // Отправка данных
                messages.sendData('delPoint', true, flags, socket);
            }
        });
    };


/*====================================================== Заявки ======================================================*/

// Получить список заявок согласно правам доступа
commands.list.getTickets = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.getTickets(user.user_id, function (err, tickets) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно получить список заявок.', socket);
                }
                else {
                    // Отправка данных
                    messages.sendData('getTickets', tickets, flags, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос списка заявок.', socket);
        }
    });
};

// Получить заявку по ее ID
commands.list.getTicket = function (data, flags, socket, sessionID) {
    db.getTicket(data.ticketID, function (err, ticket) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные заявки.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getTicket', ticket, flags, socket);
        }
    });
};

// Добавить заявку
commands.list.addTicket = function (data, flags, socket, sessionID) {
    // Выполнение поиска уч. записи от которой добавляется точка
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.getPersonByUserID(user.user_id, function (person) {
                if (person) {
                    db.addTicket(data, person.person_id, function (err) {
                        if (err) {
                            // Отправка ошибки
                            messages.sendError('Ошибка. Невозможно добавить заявку.', socket);
                        }
                        else {
                            // Отправка информации
                            messages.sendInfo('Точка добавлена', socket);
                            // Отправка данных
                            messages.sendData('addTicket', true, flags, socket);
                            // Отправка всем сообщения обновить данные
                            messages.sendBroadcastCommand({name: 'newTicket'}, socket);
                        }
                    });
                }
                else {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно найти персону от чьего имени добавляется точка.', socket);
                }
            })
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно найти пользователя от чьего имени добавляется точка.', socket);
        }
    });
};

// Получить список форм погрузки груза
commands.list.getLoadTypes = function (data, flags, socket, sessionID) {
    // Отправка данных
    messages.sendData('getLoadTypes', db.loadTypes, flags, socket);
};

// Отклонить заявку
commands.list.rejectTicket = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.rejectTicket(user, data.ticketID, data.description, function (err) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно отклонить заявку', socket);
                }
                else {
                    // Отправка информации
                    messages.sendInfo('Заявка отклонена успешно', socket);
                    // Отправка данных
                    messages.sendData('rejectTicket', true, flags, socket);
                    // Отправка всем сообщения обновить данные
                    messages.sendBroadcastCommand({name: 'newTicket'}, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос отклонения заявки.', socket);
        }
    });
};

// Взять заявку
commands.list.takeTicket = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.takeTicket(user, data.ticketID, function (err) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно взять заявку', socket);
                }
                else {
                    // Отправка информации
                    messages.sendInfo('Заявка взята в рабту', socket);
                    // Отправка данных
                    messages.sendData('takeTicket', true, flags, socket);
                    // Отправка всем сообщения обновить данные
                    messages.sendBroadcastCommand({name: 'newTicket'}, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос отклонения заявки.', socket);
        }
    });
};

// Запланировать заявку
commands.list.planTicket = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.planTicket(user, data.ticketID, function (err) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно запланировать заявку', socket);
                }
                else {
                    // Отправка информации
                    messages.sendInfo('Заявка запланирована', socket);
                    // Отправка данных
                    messages.sendData('planTicket', true, flags, socket);
                    // Отправка всем сообщения обновить данные
                    messages.sendBroadcastCommand({name: 'newTicket'}, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос перевода статуса заявки "Запланирована".', socket);
        }
    });
};

// Перевести заявку в статус "В пути"
commands.list.onWayTicket = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.onWayTicket(user, data.ticketID, function (err) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно перевести заявку в статус "В пути"', socket);
                }
                else {
                    // Отправка информации
                    messages.sendInfo('Заявка переведена в статус "В пути"', socket);
                    // Отправка данных
                    messages.sendData('onWayTicket', true, flags, socket);
                    // Отправка всем сообщения обновить данные
                    messages.sendBroadcastCommand({name: 'newTicket'}, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос перевода статуса заявки "В пути".', socket);
        }
    });
};

// Перевести заявку в статус "Закрыта"
commands.list.closeTicket = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.closeTicket(user, data, function (err) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно перевести заявку в статус "Закрыта"', socket);
                }
                else {
                    // Отправка информации
                    messages.sendInfo('Заявка переведена в статус "Закрыта"', socket);
                    // Отправка данных
                    messages.sendData('closeTicket', true, flags, socket);
                    // Отправка всем сообщения обновить данные
                    messages.sendBroadcastCommand({name: 'newTicket'}, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос закрытия заявки.', socket);
        }
    });
};


/*================================================== Архивные заявки =================================================*/

// Получить список заявок согласно правам доступа
commands.list.getAchiveTickets = function (data, flags, socket, sessionID) {
    users.getUserBySessionID(sessionID, function (user) {
        if (user) {
            db.getAchiveTickets(user.user_id, function (err, tickets) {
                if (err) {
                    // Отправка ошибки
                    messages.sendError('Ошибка. Невозможно получить список архивных заявок.', socket);
                }
                else {
                    // Отправка данных
                    messages.sendData('getAchiveTickets', tickets, flags, socket);
                }
            });
        }
        else {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить данные пользователя выполнившего запрос списка архивных заявок.', socket);
        }
    });
};


/*================================================== История заявок ==================================================*/

// Получить историю заявки по ее ID
commands.list.getTicketHistory = function (data, flags, socket, sessionID) {
    db.getTicketHistory(data.ticketID, function (err, ticketHistory) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно получить историю заявки.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getTicketHistory', ticketHistory, flags, socket);
        }
    });
};

/*===================================================== Отчеты ====================================================== */
commands.list.getReport_dayReport = function (data, flags, socket, sessionID) {
    db.getReport_dayReport(data.date, function (err, report) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно создать отчет.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getReport_dayReport', report, flags, socket);
        }
    });
};

commands.list.getReport_periodReport = function (data, flags, socket, sessionID) {
    db.getReport_periodReport(data, function (err, report) {
        if (err) {
            // Отправка ошибки
            messages.sendError('Ошибка. Невозможно создать отчет.', socket);
        }
        else {
            // Отправка данных
            messages.sendData('getReport_periodReport', report, flags, socket);
        }
    });
};


module.exports = commands;