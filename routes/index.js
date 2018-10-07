var express = require('express');
var router = express.Router();
var users = require('../lib/users');
var db = require('../lib/db');
var pkg = require('../package.json');
var version = pkg.version;

var cloneObject = function (obj) {
    var res = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            res[key] = obj[key];
    }
    return res;
};


// Стартовый обработчик маршрута
var startingRouter = function (req, res, next) {
    // Отсев страницы авторизации
    if (req.url.substr(0, 6) === '/logon')
        logonRouter(req, res);
    else {
        //Проверка авторизации
        checkAuth(req, res);
    }
};

// Проверка авторизации
var checkAuth = function (req, res) {
    users.getUserBySessionID(req.sessionID, function (user) {
        if (user === undefined) {
            res.redirect('/logon');
        }
        else {
            // Запрос списка разрешений для пользователя по его ID
            db.getUserPermissions(user.user_id, function (permissions) {
                user.permissions = permissions;

                req.user = user;
                pageCheck(req, res);
            });
        }
    });
};

// Функция сбора информации о странице
var pageCheck = function (req, res) {
    var url = req.url.split('?')[0];
    db.getPageByURL(url, function (page) {
        if (page === undefined) {
            // Страница не найдена
            res.status(404);
            req.page = {
                path: '_layouts/404',
                title: 'Ошибка 404'
            };
            renderPage(req, res);
        }
        else {
            req.page = page;
            //Проверка, есть ли у пользователя права на просмотр данной страницы
            checkUserPermissions(req, res);
        }
    });
};

// Проверка права доступа пользователя к данной странице
var checkUserPermissions = function (req, res) {
    var url = req.url.split('?')[0];
    db.checkUserPermissionViewPage(url, req.user, function (result) {
        if (result)
            getSidebar(req, res);
        else {
            // Отказано в доступе
            res.status(403);
            req.page = {
                path: '_layouts/403',
                title: 'Ошибка 403'
            };
            renderPage(req, res);
        }
    });
};

// Функция присоединения боковой панели (данных)
var getSidebar = function (req, res) {
    db.getSidebarPagesForUser(req.user, function (pages) {
        // Формирование массива боковой панели (первый уровень)
        var sidebar = pages.filter(function (page) {
            if (page.menu_level === 1) {
                page.submenu = [];
                return page;
            }
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

        // Правка пустых путей
        if (req.page.path === '' || req.page.path == null || req.page.path === undefined) {
            req.page.path = '';
            for (var i = 0; i < sidebar.length; i++) {
                if (req.page.page_id === sidebar[i].page_id) {
                    res.redirect(sidebar[i].submenu[0].url);
                }
            }
        }
        else {
            req.page.sidebar = sidebar;

            // Создание pagebar
            var pagebar = [];
            if (req.page.menu_level === 2) {
                pagebar = pages.filter(function (page) {
                    if (page.parent_page_id === req.page.parent_page_id)
                        return page;
                });

                // Правка названия страницы у страниц второго урвня
                req.page.title = pages.filter(function (page) {
                    if (page.page_id === req.page.parent_page_id)
                        return page;
                })[0].title;
            }

            req.page.pagebar = pagebar;

            req.version = version;

            renderPage(req, res);
        }
    });
};


// Роутер страницы авторизации
var logonRouter = function (req, res) {
    // Проверка авторизован ли пользователь
    users.getUserBySessionID(req.sessionID, function (user) {
        if (user)
        // Пользователь уже зарегистрирован
        // Переброс на главную страницу
            res.redirect('/');
        else {
            req.page = {
                path: 'logon',
                title: 'Авторизация'
            };
            renderPage(req, res);
        }
    });
};

// Функция отображения страницы
var renderPage = function (req, res) {
    //req.page.title = req.page.title + ' - ProLog';
    res.locals.page = req.page;

    if (req.user) {
        // Вычисление фамилии и инициалов пользователя
        s = req.user.person.surname;
        n = req.user.person.name === null ? '' : req.user.person.name.substr(0, 1) + '.';
        p = req.user.person.patronymic === null ? '' : req.user.person.patronymic.substr(0, 1) + '.';
        req.user.person.snp = (s + ' ' + n + p).trim();

        res.locals.user = cloneObject(req.user);

        delete res.locals.user.user_id;
        delete res.locals.user.password_hash;
        delete res.locals.user.enable;
        delete res.locals.user.sessionID;
        delete res.locals.user.person.person_id;
    }
    if (req.sidebar)
        res.locals.sidebar = req.sidebar;
    res.locals.version = req.version;

    res.render(req.page.path);
};

router.get('*', startingRouter);

/* GET home page.
router.get('/', function (req, res, next) {
    res.render('index', {title: 'Express'});
});

router.get('/logon', function (req, res, next) {
    res.render('logon', {title: 'Express'});
});
*/


module.exports = router;
