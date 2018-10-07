var bus = new Vue();

var cloneObject = function (obj) {
    var res = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            res[key] = obj[key];
    }
    return res;
};

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

Vue.directive('click-outside', {
    bind: function (el, binding, vnode) {
        this.evt = function (e) {
            var itsChildren = el.contains(e.target);
            if (!itsChildren && el !== e.target)
                vnode.context[binding.expression]();
        };

        document.body.addEventListener('click', this.evt, false);
    },
    unbind: function () {
        document.body.removeEventListener('click', this.evt, false);
    }
});


// v-Item
// <v-item :value="user" title="full_snp" :avatar="user.avatar" :clickable="true" @click="showPerson"></v-item>
Vue.component('v-item', {
    template: '<div class="v-item" :class="itemClas">\
        <img :src="avatar" class="avatar" v-if="avatar" @click="click">\
        <div class="v-item-body" @click="click">\
            <span class="title">{{ value[title] }}</span>\
            <span class="subtitle" v-if="value[subtitle] && value[subtitle] !== \'\'">{{ value[subtitle] }}</span>\
        </div>\
        <span class="space stretch"></span>\
        <button class="toggle" v-if="secondIcon" @click="secondClick"><i class="mdi mdi-24px mdi-delete"></i></button> \
    </div>',
    props: {
        value: Object,
        title: String,
        subtitle: String,
        avatar: String,
        clickable: Boolean,
        secondIcon: String
    },
    computed: {
        itemClas: function () {
            var classArray = [];
            if (this.clickable)
                classArray.push('clickable');
            if (this.avatar || this.subtitle)
                classArray.push('min-72px');
            return classArray;
        }
    },
    methods: {
        click: function () {
            if (this.clickable)
                this.$emit('click', this.value);
        },
        secondClick: function () {
            if (this.secondIcon)
                this.$emit('second-click', this.value);
        }
    }
});


// v-List
// <v-list :value="users" v-key="user_id" title="login" subtitle="full_snp" :clickable="true" @click="showUser"></v-list>
Vue.component('v-list', {
    template: '<div class="v-list">\
        <v-item v-for="item in filteredData" :key="item[keys]"\
            :value="item"\
            :title="title"\
            :subtitle="subtitle"\
            :avatar="item[avatar]"\
            :clickable="clickable"\
            @click="click"\
            :second-icon="secondIcon"\
            @second-click="secondClick">\
        </v-item>\
    </div>',
    props: {
        value: Array,
        keys: String,
        title: String,
        subtitle: String,
        avatar: String,
        clickable: Boolean,
        filter: String,
        secondIcon: String
    },
    computed: {
        filteredData: function () {
            if (this.filter === '' || this.filter === undefined)
                return this.value;
            else {
                var self = this;
                return this.value.filter(function (item) {
                    return item[self.title].toLowerCase().indexOf(self.filter.toLowerCase()) > -1;
                });
            }
        }
    },
    methods: {
        click: function (item) {
            if (this.clickable)
                this.$emit('click', item);
        },
        secondClick: function (item) {
            if (this.secondIcon)
                this.$emit('second-click', item);
        }
    }
});

// v-Input
Vue.component('v-input', {
    template: '<div class="v-input">\
        <input class="inline-input" :type="type" @input="updateInput($event.target.value)" :value="value" :placeholder="placeholder" :readonly="readonly">\
        <span :class="checkValue" @click="focusInput">{{ label }}</span>\
    </div>',
    props: {
        type: String,
        value: String,
        placeholder: String,
        label: String,
        readonly: Boolean
    },
    computed: {
        checkValue: function () {
            return (this.placeholder !== undefined) || ((this.value !== undefined) && (this.value.length > 0)) ? 'top' : '';
        }
    },
    methods: {
        updateInput: function (value) {
            this.$emit('input', value);
        },
        focusInput: function (event) {
            event.target.previousElementSibling.focus();
        }
    }
});

// vmd-Input
// todo: disabled, read only, max length, keyup
Vue.component('vmd-input', {
    template: '<div class="vmd-input" @click="emitClick">\
        <div class="body">\
            <span class="lead-icon" v-if="leadIcon"><i :class="[\'mdi\', \'mdi-24px\', \'mdi-\' + leadIcon]"></i></span>\
            <span class="trailing-icon" v-if="trailingIcon"><i :class="[\'mdi\', \'mdi-24px\', \'mdi-\' + trailingIcon]"></i></span>\
            <input :type="type" :value="value" @input="bindValue" :placeholder="placeholder" :readonly="readonly">\
            <span :class="labelClass" @click="clickLabel">{{ label }}</span>\
            <span class="trailing-text" v-if="trailingText">{{ trailingText }}</span>\
        </div>\
        <span :class="[\'helper\', leadIcon ? \'lead-icon\' : \'\']" v-if="!noHelper">{{ helper }}</span>\
    </div>',
    props: {
        label: String,
        type: String,
        value: [String, Number],
        helper: String,
        placeholder: String,
        leadIcon: String,
        trailingText: String,
        readonly: Boolean,
        noHelper: Boolean
    },
    data: function () {
        return {
            trailingIcon: ''
        }
    },
    computed: {
        labelClass: function () {
            var top = (this.value && this.value !== '' || this.placeholder) ? 'top' : '';
            return ['label', top];
        }
    },
    methods: {
        bindValue: function (event) {
            this.$emit('input', event.target.value);
        },
        clickLabel: function (event) {
            event.target.previousElementSibling.focus();
        },
        emitClick: function (event) {
            this.$emit('click');
        }
    }
});

// vmd-Textarea
// todo: textarea

// vmd-Dropdown
// todo: disabled
Vue.component('vmd-dropdown', {
    template: '<div class="vmd-dropdown" v-click-outside="hideMenu">\
        <div class="body">\
            <span class="lead-icon" v-if="leadIcon"><i :class="[\'mdi\', \'mdi-24px\', \'mdi-\' + leadIcon]"></i></span>\
            <span class="trailing-icon"><i class="mdi mdi-24px mdi-menu-down"></i></span>\
            <input :class="readonly ? \'readonly\' : \'\'" type="text" :value="getValue(value)" @click="toggleMenu" placeholder="Выберите значение..." readonly>\
            <span class="label">{{ label }}</span>\
        </div>\
        <span :class="[\'helper\', leadIcon ? \'lead-icon\' : \'\']">{{ helper }}</span>\
        <div class="menu" v-show="menuVisible">\
            <div class="menu-item" v-for="(item, index) in items" :key="index" @click="clickItem(item)"><span>{{ getValue(item) }}</span></div>\
        </div>\
    </div>',
    props: {
        items: Array,
        label: String,
        helper: String,
        leadIcon: String,
        value: [String, Object],
        title: String,
        readonly: Boolean
    },
    data: function () {
        return {
            menuVisible: false
        }
    },
    methods: {
        toggleMenu: function () {
            if (!this.readonly)
                this.menuVisible = !this.menuVisible;
        },
        hideMenu: function () {
            if (this.menuVisible)
                this.menuVisible = false;
        },
        getValue: function (item) {
            if (typeof item === 'object' && this.title)
                return item[this.title];
            else
                return item;
        },
        clickItem: function (item) {
            var res = cloneObject(item);
            this.$emit('input', res);
            this.menuVisible = false;
        }
    }
});


// v-Select
Vue.component('v-select', {
    template: '<div class="v-select">\
        <input class="vmd-input">\
    </div>',
    props: {
        items: Array
    }
});


// v-Checkbox
Vue.component('v-checkbox', {
    template: '<div class="v-checkbox">\
                <input type="checkbox" :checked="value" @change="changedCheckbox($event.target.checked)">\
                <i :class="checkboxClass" @click="clickCheckbox"></i>\
                <span v-if="label !== undefined" @click="clickCheckbox">{{ label }}</span>\
            </div>',
    props: {
        value: Boolean,
        label: String
    },
    computed: {
        checkboxClass: function () {
            return this.value ? 'mdi mdi-24px mdi-checkbox-marked' : 'mdi mdi-24px mdi-checkbox-blank-outline';
        }
    },
    methods: {
        clickCheckbox: function () {
            event.target.previousElementSibling.click();
        },
        changedCheckbox: function (newValue) {
            this.$emit('input', newValue);
        }
    }
});

// v-Tree
Vue.component('v-tree-item', {
    template: '<li class="v-tree-item">\
                <div class="v-tree-item-body" @click="toggle">\
                    <i :class="arrowClass" v-if="hasSubtree"></i>\
                    <v-checkbox v-if="item[values.type] === \'checkbox\'" v-model="item.checked" :label="item[values.title]"></v-checkbox>\
                    <span class="v-tree-title" v-if="item[values.type] !== \'checkbox\'">{{ item[values.title] }}</span>\
                </div>\
                <div class="v-tree-subtree" v-show="opened">\
                    <v-tree :tree="item[values.subtree]" :values="values"></v-tree>\
                </div>\
            </li>',
    props: {
        item: Object,
        values: Object
    },
    data: function () {
        return {
            opened: false
        }
    },
    computed: {
        hasSubtree: function () {
            return this.item[this.values.subtree] && this.item[this.values.subtree].length
        },
        arrowClass: function () {
            var c = 'mdi mdi-24px ';
            if (this.opened)
                c += 'mdi-menu-down';
            else
                c += 'mdi-menu-right';
            return c;
        }
    },
    methods: {
        toggle: function () {
            if (this.hasSubtree)
                this.opened = !this.opened;
        },
        click: function (item) {
            console.log(item);
        }
    }
});
Vue.component('v-tree', {
    template: '<ul class="v-tree">\
                <v-tree-item v-for="item, index in tree" :item="item" :values="values" :key="index"></v-tree-item>\
            </ul>',
    props: {
        tree: Array,
        values: Object
    }
});

// v-Avatar
Vue.component('v-avatar', {
    template: '<div class="avatar">\
        <div class="avatar-body">\
            <img :src="path">\
            <span @click="click" v-if="clickable">Изменить</span>\
        </div>\
    </div>',
    props: {
        path: String,
        clickable: Boolean
    },
    methods: {
        click: function () {
            this.$emit('click');
        }
    }
});

Vue.component('base-input', {
    template: '<label>\
        {{ label }}\
        <input v-bind="$attrs" :value="value" v-on="inputListeners">\
    </label>',
    inheritAttrs: false,
    props: ['label', 'value'],
    computed: {
        inputListeners: function () {
            var self = this;
            return Object.assign({},
                this.$listeners,
                // Then we can add custom listeners or override the
                // behavior of some listeners.
                {
                    // This ensures that the component works with v-model
                    input: function (event) {
                        self.$emit('input', event.target.value);
                    }
                }
            )
        }
    }
});

Vue.component('v-ticket', {
    template: '<div class="v-ticket" @click="click">\
        <div class="id" style="width: 100px;">\
            <p>Заявка № {{ ticket.ticket_id }}</p>\
            <p>{{ DateTime.fromISO(ticket.creation_datetime).setLocale(\'ru-RU\').toLocaleString() }}</p>\
            <p>{{ DateTime.fromISO(ticket.creation_datetime).setLocale(\'ru-RU\').toLocaleString(DateTime.TIME_24_WITH_SECONDS) }}</p>\
        </div>\
        <div class="load-point-body" style="width: calc(50% - 300px);">\
            <p>{{ ticket.load_point_state_name }}</p>\
            <p>{{ ticket.load_organization_name }}</p>\
            <p>{{ ticket.load_point_full_address }}</p>\
        </div>\
        <div class="unload-point-body" style="width: calc(50% - 300px);">\
            <p>{{ ticket.unload_point_state_name }}</p>\
            <p>{{ ticket.unload_organization_name }}</p>\
            <p>{{ ticket.unload_point_full_address }}</p>\
        </div>\
        <div class="weight-volume" style="width: 100px;">\
            <p>{{ ticket.weight }} кг.</p>\
            <p>{{ ticket.volume }} куб.м.</p>\
        </div>\
        <div style="width: 100px;" :class="ticketStatus">\
            <p>{{ ticket.status_name }}</p>\
        </div>\
        <div style="width: 300px;">\
            <p>{{ ticket.notes }}</p>\
        </div>\
    </div>',
    props: {
        ticket: Object,
        loadCityFilter: String
    },
    data: function () {
        return {
            DateTime: luxon.DateTime
        }
    },
    computed: {
        ticketStatus: function () {
            var st = '';
            switch(this.ticket.status_id) {
                case 1:
                    st = 'blue';
                    break;
                case 2:
                    st = 'grey';
                    break;
                case 3:
                    st = 'teal';
                    break;
                case 4:
                    st = 'green';
                    break;
                case 5:
                    st = 'light-grey';
                    break;
                default:
                    st = 'red';
            }
            return st;
        }
    },
    methods: {
        click: function () {
            this.$emit('click', this.ticket);
        }
    }
});

Vue.component('ticket-history', {
    template: '<div class="ticket-history">\
        <p v-for="(item, index) in value" :key="index"><strong>{{ item.creation_datetime }}:</strong> {{ item.event_description }}</p>\
    </div>',
    props: {
        value: Array
    }
});

Vue.component('vmd-datepicker', {
    template: '<div class="vmd-datepicker" v-click-outside="hideCalendar">\
        <vmd-input lead-icon="calendar-text" readonly v-model="select" :no-helper="true" @click="visible = !visible" :label="label"></vmd-input>\
        <div class="vmd-datepicker_body" :class="visible ? \'opened\' : \'\'" >\
            <div class="vmd-datepicker_body-header">\
                <button class="toggle" @click="prevMonth"><i class="mdi mdi-24px mdi-chevron-left"></i></button>\
                <h4>{{ calMonth }}, {{ calYear }}</h4>\
                <button class="toggle" @click="nextMonth"><i class="mdi mdi-24px mdi-chevron-right"></i></button>\
            </div>\
            <div class="vmd-datepicker_body-calendar">\
                <div class="header">\
                    <div class="tr">\
                        <div class="td">Пн</div>\
                        <div class="td">Вт</div>\
                        <div class="td">Ср</div>\
                        <div class="td">Чт</div>\
                        <div class="td">Пт</div>\
                        <div class="td">Сб</div>\
                        <div class="td">Вс</div>\
                    </div>\
                </div>\
                <div class="body">\
                    <div class="tr" v-for="(w, i1) in cal" :key="i1">\
                        <div class="td" :class="dayClass(d)" v-for="(d, i2) in w" :key="i2" @click="changeDay(d)">\
                            {{ d }}\
                        </div>\
                    </div>\
                </div>\
            </div>\
        </div>\
    </div>',
    data: function () {
        return {
            visible: false,
            calMoment: moment(),
            selectedDate: moment(),
            select: ''
        }
    },
    props: {
        label: String
    },
    computed: {
        calYear: function () {
            return moment(this.calMoment).format('YYYY');
        },
        calMonth: function () {
            return moment(this.calMoment).format('MMMM');
        },
        calDay: function () {
            return parseInt(moment(this.calMoment).format('D'));
        },
        cal: function () {
            var first = this.calMoment.clone().startOf('month').week();
            var last = this.calMoment.clone().endOf('month').week();
            if( first > last) {
                last = this.calMoment.clone().weeksInYear() + 1;
            }

            var cal = new Array(last - first + 1);
            var firstDay = this.dayConvert(this.calMoment.clone().startOf('month').day());
            var lastDay = this.calMoment.clone().endOf('month').date();
            var cntr = 1;
            for (var w = 0; w < cal.length; w++) {
                cal[w] = new Array(7);
                for (var d = 0; d < 7; d++) {

                    if (w === 0) {
                        if (d >= firstDay)
                            cal[w][d] = cntr++;
                    }
                    else {
                        if (cntr <= lastDay)
                            cal[w][d] = cntr++;
                    }
                }
            }

            return cal;
        }
    },
    methods: {
        dayConvert: function (day) {
            return day === 0 ? 6 : day - 1;
        },
        dayClass: function (day) {
            var res = '';
            if (day === parseInt(moment(this.selectedDate).format('D')) && this.calMoment.month() === this.selectedDate.month() && this.calMoment.year() === this.selectedDate.year())
                res = 'active';
            return res;
        },
        changeDay: function (day) {
            this.selectedDate = this.calMoment.clone().date(day);
            this.select = moment(this.selectedDate).format('DD.MM.YYYY');
            this.visible = false;
            this.$emit('input', this.select);
        },
        prevMonth: function () {
            this.calMoment = moment(this.calMoment).add(-1, 'M');
        },
        nextMonth: function () {
            this.calMoment = moment(this.calMoment).add(1, 'M');
        },
        hideCalendar: function () {
            if (this.visible)
                this.visible = false;
        }
    }
});