
/* Global variables */

var appModule = angular.module('appModule',['ngRoute','ngAnimate'])

/*  Filters    */

// Tells if an object is instance of an array type. Used primary within ng-templates
appModule.filter('isArray', function() {
  return function (input) {
    return angular.isArray(input);
  };
});


// Add new item to list. Used primary within ng-templates
appModule.filter('append', function() {
  return function (input, item) {
    input.push(item);
    return input;
  };
});

// Remove item from list. Used primary within ng-templates
appModule.filter('remove', function() {
  return function (input, item) {
    input.splice(input.indexOf(item),1);
    return input;
  };
});

// Capitalize the first letter of a word
appModule.filter('capitalize', function() {

  return function(token) {
      return token.charAt(0).toUpperCase() + token.slice(1);
   }
});

// Replace any especial character for a space
appModule.filter('removeSpecialCharacters', function() {

  return function(token) {
      return token.replace(/#|_|-|$|!|\*/g,' ').trim();
   }
});

/*  Configuration    */

// Application routing
appModule.config(function($routeProvider, $locationProvider){
    // Maps the URLs to the templates located in the server
    $routeProvider
        .when('/', {templateUrl: 'ng/home'})
        .when('/catalog/services', {templateUrl: 'ng/catalog/services'})
        .when('/catalog/services/new/:name', {templateUrl: function(params){ return 'ng/catalog/services/new/' + params.name;} })

        .when('/running/services', {templateUrl: 'ng/running/services'})

        .when('/devices', {templateUrl: 'ng/devices'})

        .when('/devices/new', {templateUrl: 'ng/devices/new'})

        .when('/dashboard', {templateUrl: 'ng/dashboard'})

        .when('/alerts', {templateUrl: 'ng/alerts'})

        .when('/settings', {templateUrl: 'ng/settings'})

    $locationProvider.html5Mode(true);
});

// Add to all requests the authorization header
appModule.config(function ($httpProvider){

    $httpProvider.interceptors.push('authInterceptor');
});


appModule.filter('capitalize', function() {
    // Capitalize the first letter of a word
  return function(token) {
      return token.charAt(0).toUpperCase() + token.slice(1);
   }
});

// To avoid conflicts with other template tools such as Jinja2, all between {a a} will be managed by ansible instead of {{ }}
appModule.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{a');
  $interpolateProvider.endSymbol('a}');
}]);

/* Factories */

// The notify factory allows services to notify to an specific controller when they finish operations
appModule.factory('NotifyingService', function($rootScope) {
    return {
        subscribe: function(scope, callback) {
            var handler = $rootScope.$on('notifying-service-event', callback);
            scope.$on('$destroy', handler);
        },

        notify: function() {
            $rootScope.$emit('notifying-service-event');
        }
    };
});

// The auth notify factory allows other components subscribe and being notified when authentication is successful
appModule.factory('AuthNotifyingService', function($rootScope) {
    return {
        subscribe: function(scope, callback) {
            var handler = $rootScope.$on('notifying-auth-event', callback);
            scope.$on('$destroy', handler);
        },

        notify: function() {
            $rootScope.$emit('notifying-auth-event');
        }
    };
});

// This factory adds the token to each API request
appModule.factory("authInterceptor", function($rootScope, $q, $window){
    return {
        request: function(config){
            config.headers = config.headers  || {};
            if ($window.sessionStorage.token){
                config.headers.Authorization = 'Bearer ' + $window.sessionStorage.token;
            }
            return config;
        },
        responseError: function(rejection){
            if (rejection.status === 401){
                //Manage common 401 actions
            }
            return $q.reject(rejection);
        }
    };
});

/*  Services    */

/* Authentication */
appModule.service("AuthService", function($window, $http, $location, AuthNotifyingService){
    function url_base64_decode(str){
        return window.atob(str)
    }

    this.url_base64_decode = url_base64_decode

    // if token is not stored, try to get it if not in login page
    if ($location.$$path != '/login'){
        if (!$window.sessionStorage.token){
            $http
            .get('api/token')
            .then(function (response, status, headers, config){
                $window.sessionStorage.token = response.data.token;
                AuthNotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                // Any issue go to login
                $window.location.href = '/login'
            })

        }
    }
})

// Store devices and selected devices
appModule.service('DeviceService', function($http, NotifyingService,$window) {
    var devices = []
    var selected_device = {}

    function setDevices(p_devices) {
        devices = p_devices;
    }

    function getDevices() {
        return devices;
    }

    function setSelectedDevice(p_selected_device) {
        selected_device = p_selected_device;
    }
    function getSelectedDevice() {
        return selected_device;
    }

    function refreshData(){
        // Get devices from NSO
        $http
            .get("api/devices")
            .then(function (response, status, headers, config){
                devices = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){

            })
            .finally(function(){
            })
    }

    function addDevicesToNSO(){
        // Add devices to NSO
        $http
            .post("api/devices", {'devices': selected_devices})
            .then(function (response, status, headers, config){
                create_notification('Devices added', '' , 'success', 5000)
            })
            .catch(function(response, status, headers, config){
                create_notification('Error adding device', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshData();

            // Refresh data each 10 secs
            setInterval(function(){ refreshData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        setSelectedDevice: setSelectedDevice,
        getSelectedDevice: getSelectedDevice,
        setDevices: setDevices,
        getDevices: getDevices,
        refreshData: refreshData,
        addDevicesToNSO: addDevicesToNSO
    }


});

// Store NSO services and selected services
appModule.service('ServiceService', function($http, NotifyingService,$window) {
    // variables
    var services = []
    var selected_service = {}

    var running_services = []
    var running_service = {}

    // functions
    function setRunningServices(p_running_services) {
        running_services = p_running_services;
    }

    function getRunningServices() {
        return running_services;
    }

    function setSelectedRunningService(p_service) {
        running_service = p_service;
    }

    function getSelectedRunningService() {
        return running_service;
    }

    function setServices(p_services) {
        services = services;
    }

    function getServices() {
        return services;
    }

    function setSelectedService(p_selected_service) {
        selected_service = p_selected_service;
    }
    function getSelectedService() {
        return selected_service;
    }

    function refreshServicesData (){
        // Get devices managed from NSO
        $http
            .get("api/catalog/services")
            .then(function (response, status, headers, config){
                services = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting services', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function refreshRunningServicesData (){
        // Get devices managed from NSO
        $http
            .get("api/running/services")
            .then(function (response, status, headers, config){
                running_services = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting services', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshServicesData();
            refreshRunningServicesData();

            // Refresh data each 10 secs
            setInterval(function(){ refreshServicesData(); }, 10000);
            setInterval(function(){ refreshRunningServicesData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();
    return {
        setSelectedService: setSelectedService,
        getSelectedService: getSelectedService,
        setServices: setServices,
        getServices: getServices,
        getRunningServices: getRunningServices,
        getSelectedRunningService: getSelectedRunningService,
        setRunningServices: setRunningServices,
        setSelectedRunningService: setSelectedRunningService,
        refreshServicesData: refreshServicesData,
        refreshRunningServicesData: refreshRunningServicesData
    }

});

// Store NSO authentication groups
appModule.service('AuthGroupsService', function($http, NotifyingService,$window) {
    // variables
    var authGroups = []



    function setAuthGroups(p_groups) {
        authGroups = p_groups;
    }

    function getAuthGroups() {
        return authGroups;
    }

    function refreshAuthGroupsData (){
        // Get devices managed from NSO
        $http
            .get("api/authgroups/")
            .then(function (response, status, headers, config){
                authGroups = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting Authentication groups', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshAuthGroupsData();

            // Refresh data each 10 secs
            setInterval(function(){ refreshAuthGroupsData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        refreshAuthGroupsData: refreshAuthGroupsData,
        setAuthGroups: setAuthGroups,
        getAuthGroups: getAuthGroups
    }

});

// Store protocols
appModule.service('ProtocolsService', function($http, NotifyingService,$window) {
    // variables
    var protocols = []

    function setProtocols(p) {
        protocols = p;
    }

    function getProtocols() {
        return protocols;
    }

    function refreshProtocolsData (){
        // Get devices managed from NSO
        $http
            .get("api/protocols/")
            .then(function (response, status, headers, config){
                protocols = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting protocols ', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshProtocolsData();
            // Refresh data each 10 secs
            setInterval(function(){ refreshProtocolsData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        refreshProtocolsData: refreshProtocolsData,
        setProtocols: setProtocols,
        getProtocols: getProtocols
    }

});

// Store device types
appModule.service('DeviceTypesService', function($http, NotifyingService,$window) {
    // variables
    var device_types = []

    function setDeviceTypes(p) {
        device_types = p;
    }

    function getDeviceTypes() {
        return device_types;
    }

    function refreshDeviceTypesData (){
        // Get devices managed from NSO
        $http
            .get("api/device_types/")
            .then(function (response, status, headers, config){
                device_types = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting device types ', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshDeviceTypesData();
            // Refresh data each 10 secs
            setInterval(function(){ refreshDeviceTypesData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        refreshDeviceTypesData: refreshDeviceTypesData,
        setDeviceTypes: setDeviceTypes,
        getDeviceTypes: getDeviceTypes
    }

});

// Store NEDs
appModule.service('NEDsService', function($http, NotifyingService,$window) {
    // variables
    var neds = []

    function setNEDs(p) {
        neds = p;
    }

    function getNEDs() {
        return neds;
    }

    function refreshNEDsData (){
        // Get devices managed from NSO
        $http
            .get("api/neds/")
            .then(function (response, status, headers, config){
                neds = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting Network Element Drivers ', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshNEDsData();
            // Refresh data each 10 secs
            setInterval(function(){ refreshNEDsData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        refreshNEDsData: refreshNEDsData,
        setNEDs: setNEDs,
        getNEDs: getNEDs
    }

});

// Store Alerts
appModule.service('AlertsService', function($http, NotifyingService,$window) {
    // variables
    var alerts = []

    function setAlerts(p) {
        alerts = p;
    }

    function getAlerts() {
        return alerts;
    }

    function refreshAlertsData (){
        // Get devices managed from NSO
        $http
            .get("api/alerts/")
            .then(function (response, status, headers, config){
                alerts = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting Alerts ', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshAlertsData();
            // Refresh data each 10 secs
            setInterval(function(){ refreshAlertsData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        refreshAlertsData: refreshAlertsData,
        setAlerts: setAlerts,
        getAlerts: getAlerts
    }

});

// Store NSO Data
appModule.service('NSOService', function($http, NotifyingService,$window) {
    // variables
    var nso = {}

    function setNSO(p) {
        nso = p;
    }

    function getNSO() {
        return nso;
    }

    function refreshNSOData (){
        // Get devices managed from NSO
        $http
            .get("api/nso/")
            .then(function (response, status, headers, config){
                nso = response.data
                NotifyingService.notify();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error getting NSO details ', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
    }

    function init(){
        // Only gets data when there is a token
        if($window.sessionStorage.token){
            refreshNSOData();
            // Updates data each 10 secs.
            setInterval(function(){ refreshNSOData(); }, 10000);
        }
        else {
            // If no Token, then tries again each second
            setTimeout(function(){ init(); }, 1000);
        }
    }

    init();

    return {
        refreshNSOData: refreshNSOData,
        setNSO: setNSO,
        getNSO: getNSO
    }

});

/*  Controllers    */

appModule.controller('AuthController', function($scope, $http, $window, AuthService, AuthNotifyingService){

    $scope.user = {username: '', password: ''}
    $scope.isAuthenticated = false
    $scope.token = $window.sessionStorage.token;

    $scope.submit = function (){
        $scope.message = "Working...";
        $http
            .post('api/login', $scope.user)
            .then(function (response, status, headers, config){
                $window.sessionStorage.token = response.data.token;
                $scope.token = $window.sessionStorage.token;
                $scope.isAthenticated = true;
                $scope.message = "Success! Loading application";
                $window.location.href = '/index'
            })
            .catch(function(response, status, headers, config){
                delete $window.sessionStorage.token;
                $scope.isAuthenticated = false;
                $scope.message = response.data;
            })
    }

    $scope.logout = function() {
        $scope.isAuthenticated = false;
        $window.sessionStorage.token = '';
        $window.location.href = '/web/logout'
    }

    AuthNotifyingService.subscribe($scope, function updateToken() {
        $scope.token = $window.sessionStorage.token;
    });
});


//Location controller is in charge of managing the routing location of the application
appModule.controller('LocationController', function($scope, $location){
     $scope.go = function ( path ) {
        $location.path( path );
    };
});

// App controller is in charge of managing all services for the application
appModule.controller('AppController', function($scope, $location, $http, DeviceService, ServiceService, NotifyingService, AuthGroupsService, NEDsService, ProtocolsService, DeviceTypesService, AlertsService, NSOService){
    // variables
    $scope.services = ServiceService.getServices();
    $scope.service = ServiceService.getSelectedService();

    $scope.devices = DeviceService.getDevices();
    $scope.device = DeviceService.getSelectedDevice();

    $scope.running_services = ServiceService.getRunningServices();
    $scope.running_service = ServiceService.getSelectedRunningService();

    $scope.neds = NEDsService.getNEDs();

    $scope.device_types = DeviceTypesService.getDeviceTypes();

    $scope.protocols = ProtocolsService.getProtocols();

    $scope.authgroups = AuthGroupsService.getAuthGroups();

    $scope.alerts = AlertsService.getAlerts();

    // Used to instantiate services from service catalogs
    $scope.list = {};

    $scope.nso = NSOService.getNSO()

    // Methods
    $scope.setService = function (service){
        ServiceService.setSelectedService(service)
        $scope.service = ServiceService.getSelectedService();
    }

    $scope.setRunningService = function (service){
        ServiceService.setSelectedRunningService(service)
        $scope.running_service = ServiceService.getSelectedRunningService();
    }

    $scope.setDevice = function (device){
        DeviceService.setSelectedDevice(device)
        $scope.device = DeviceService.getSelectedDevice();
    }

    NotifyingService.subscribe($scope, function updateCustomers() {
        // It is called each time data from services changes
        $scope.services = ServiceService.getServices();
        $scope.devices = DeviceService.getDevices();
        $scope.running_services = ServiceService.getRunningServices();
        $scope.running_service = ServiceService.getSelectedRunningService();
        $scope.neds = NEDsService.getNEDs();
        $scope.device_types = DeviceTypesService.getDeviceTypes();
        $scope.protocols = ProtocolsService.getProtocols();
        $scope.authgroups = AuthGroupsService.getAuthGroups();
        $scope.alerts = AlertsService.getAlerts();
        $scope.nso = NSOService.getNSO();
    });

    // Send service to NSO
    $scope.sendService = function (){
        $http
            .post('api/running/services', $scope.service)
            .then(function (response, status, headers, config){
                create_notification('Service created', '' , 'success', 5000)
                ServiceService.refreshRunningServicesData();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })

        create_notification('Sending service...', '' , 'info', 5000)
        $location.path('running/services');
    }

    // Delete service from NSO
    $scope.deleteService = function (){
        $http
            .post('api/running/services/delete', $scope.running_service)
            .then(function (response, status, headers, config){
                create_notification('Service removed', '' , 'success', 5000)
                ServiceService.refreshRunningServicesData();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })

        create_notification('Removing service...', '' , 'info', 5000)
        $location.path('running/services');
    }

    // Send device to NSO
    $scope.sendDevice = function (){
        $http
            .post('api/devices/', $scope.device)
            .then(function (response, status, headers, config){
                create_notification('Device Added', '' , 'success', 5000)
                DeviceService.refreshData();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })

        create_notification('Sending device...', '' , 'info', 5000)
        $location.path('devices');
    }

    // Delete device from NSO
    $scope.deleteDevice = function (){
        $http
            .post('api/devices/delete', $scope.device)
            .then(function (response, status, headers, config){
                create_notification('Device removed', '' , 'success', 5000)
                DeviceService.refreshData();
            })
            .catch(function(response, status, headers, config){
                create_notification('Error', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
            create_notification('Removing device...', '' , 'info', 5000)
            $location.path('devices');
    }

    // Delete device from NSO
    $scope.NSOSync = function (){
        $http
            .post('api/catalog/services')
            .then(function (response, status, headers, config){
                create_notification('Sync process started', '' , 'success', 5000)
            })
            .catch(function(response, status, headers, config){
                create_notification('Error', response.data.message , 'danger', 0)
            })
            .finally(function(){
            })
            $scope.nso.sync_state = 'daemon_start_requested'
            create_notification('Starting sync...', '' , 'info', 5000)
    }


    // Location logic. This tells the controller what to do according the URL that the user currently is
    $scope.$on('$locationChangeStart', function(event) {
        if ($location.$$path === '/devices/new'){
            $scope.device = {};
        }
        if ($location.$$path === '/devices'){
            $scope.device = {};
        }
    });

});