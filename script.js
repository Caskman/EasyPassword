// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

angular.module('EasyDiceWare', [])
.controller('MainController', ['$scope', '$http', '$timeout', '$q', function($scope, $http, $timeout, $q) {

    $scope.quota = 0;
    $scope.words = [];
    $scope.passLength = 4;
    var POINTS_PER_WORD = 25;
    var _dicewareList = {};
    var _

    $scope.init = function() {
        
        // $http.get('/diceware-standard.txt').then(function(response) {
        //     $scope.dicewareList = response.data;
        // });

        _checkQuota().then(function(quota) {
            return _promise(function(resolve, reject) {
                if (quota >= POINTS_PER_WORD * $scope.passLength) {
                    $q.all({
                        nums: _getNums(5 * $scope.passLength),
                        dicewareList: _getDicewareList()
                    }).then(function(results) {
                        _dicewareList = results.dicewareList;
                        resolve(results.nums);
                    });
                } else {
                    reject();
                }
            });
        }).then(_mapNums).then(function(words) {
            $scope.words = words;
            $scope.areWordsReady = true;
        });
    }

    var _promise = function(f) {
        return $q(function(resolve, reject) {
            $timeout(function() {
                f(resolve, reject);
            });
        })
    }

    var _getDicewareList = function() {
        return _promise(function(resolve, reject) {
            $http.get('diceware-standard.txt').then(function(response) {
                var data = response.data;
                var rows = data.split('\n');
                var list = _.reduce(rows, function(m, r) {
                    var splits = r.split('\t');
                    m[splits[0]] = splits[1];
                    return m;
                }, {});
                resolve(list);
            });
        }); 
    }

    var _mapNums = function(nums) {
        var current = '';
        var wordNums = [];
        _.each(nums, function(e) {
            current = current + e;
            if (current.length == 5) {
                wordNums.push(current);
                current = '';
            }
        });
        return _.map(wordNums, function(wn) {
            return _dicewareList[wn];
        })
    }

    var _checkQuota = function() {
        return _promise(function(resolve, reject) {
            $http.get('https://www.random.org/quota/?format=plain').then(function(response) {
                $scope.quota = parseInt(response.data);
                resolve($scope.quota);
            });
        });
    }

    var _getNums = function() {
        return $http.get(_getRNGUrl(20)).then(function(response) {
            var d = response.data;
            return _.map(d.split('\n').slice(0,-1), function(e) {
                return parseInt(e);
            });
        });
    }

    var _getRNGUrl = function(num) {
        return 'https://www.random.org/integers/?num={0}&min=1&max=6&col=1&base=10&format=plain&rnd=new'.format(num);
    }

}]);