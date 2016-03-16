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
    $scope.passwordWordLength = 4;
    $scope.numPasswords = 1000;
    $scope.useRandomOrg = false;
    var POINTS_PER_WORD = 25;
    var POINTS_PER_NUM = 5;
    var _dicewareList = {};
    var _keyboardData = {};

    $scope.init = function() {

        _checkQuota().then(_fetchData).then(_mapNumsToPasswords).then(_scorePasswords)
        .then(function(passwords) {
            $scope.passwords = passwords;
            $scope.areWordsReady = true;
        });

    }

    var _checkQuota = function() {
        return _promise(function(resolve, reject) {
            $http.get('https://www.random.org/quota/?format=plain').then(function(response) {
                $scope.quota = parseInt(response.data);
                resolve($scope.quota);
            });
        });
    }

    var _fetchData = function(quota) {
        var numPromise = null;
        var numNums = $scope.passwordWordLength * $scope.numPasswords * 5;

        if ($scope.useRandomOrg && quota >= POINTS_PER_WORD * $scope.passwordWordLength) {
            numPromise = _getRandomOrgNums(numNums);
        } else {
            numPromise = _getPsuedoRandomNums(numNums);
        }

        return $q.all({
            nums: numPromise,
            dicewareList: _getDicewareList(),
            keyboardData: _getKeyboardData()
        }).then(function(results) {
            _dicewareList = results.dicewareList;
            _keyboardData = results.keyboardData;
            return results.nums;
        });
    }

    var _mapNumsToPasswords = function(nums) {
        return _promise(function(resolve, reject) {
            var current = '';
            var wordNums = [];
            _.each(nums, function(e) {
                current = current + e;
                if (current.length == 5) {
                    wordNums.push(current);
                    current = '';
                }
            });
            var words = _.map(wordNums, function(wn) {
                return _dicewareList[wn];
            });

            current = [];
            var passwords = [];
            _.each(words, function(w) {
                current.push(w);
                if (current.length == $scope.passwordWordLength) {
                    passwords.push({
                        "words": current,
                        "score": 0
                    });
                    current = [];
                }
            });
            resolve(passwords);
        });
    }

    var _getKeyboardData = function() {
        return $http.get('keyboard_data.js').then(function(response) {
            return response.data;
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

    var _getPsuedoRandomNums = function(numNums) {
        return _promise(function(resolve, reject) {
            var nums = _.chain(_.range(numNums))
                .map(function() {
                    return Math.floor(Math.random() * 6 + 1);
                }).value();
            resolve(nums);
        });
    }

    var _getRandomOrgNums = function(numNums) {
        return $http.get(_getRNGUrl(numNums)).then(function(response) {
            var d = response.data;
            return _.map(d.split('\n').slice(0,-1), function(e) {
                return parseInt(e);
            });
        });
    }

    var _getRNGUrl = function(num) {
        return 'https://www.random.org/integers/?num={0}&min=1&max=6&col=1&base=10&format=plain&rnd=new'.format(num);
    }

    var _scorePasswords = function(passwords) {
        return _promise(function(resolve, reject) {
            _.each(passwords, function(password) {
                var whole = password.words.join('');
                var sum = _.reduce(whole, function(sum, c, i, l) {
                    var score = 5;
                    if (i > 0) {
                        var prev = _keyboardData[l[i - 1]];
                        var cur = _keyboardData[l[i]];
                        if (!_isSameHand(prev, cur)) {
                            score += 0;
                        } else {
                            if (_isSameRow(prev, cur)) {
                                score += -2;
                            }
                            if (_isSameFinger(prev, cur)) {
                                score += -5;
                            }
                        }

                        if (!_isHomeRow(cur)) {
                            if (_isNumberRow(cur)) {
                                score += -2;
                            } else {
                                score += -1;
                            }
                        }

                        if (_isShiftKey(cur)) {
                            score += -5;
                        }

                        return score + sum;
                    } else {
                        return 0;
                    }
                }, 0);
                password.score = sum / (whole.length - 1);
            });

            resolve(passwords);
        });
    }

    var _isShiftKey = function(c) {
        return c.shift;
    }

    var _isNumberRow = function(c) {
        return c.row == 1;
    }

    var _isHomeRow = function(c) {
        return c.row == 3;
    }

    var _isSameFinger = function(prev, cur) {
        var prevFinger = _getFinger(prev);
        var curFinger = _getFinger(cur);
        return prevFinger == curFinger;
    }

    var _getFinger = function(c) {
        var finger = c.col;
        if (finger == 1) return 2;
        if (finger == 6) return 5;
        if (finger == 7) return 8;
        if (finger > 11) return 11;
    }

    var _isSameRow = function(prev, cur) {
        return prev.row == cur.row;
    }

    var _getHand = function(c) {
        return c.col <= 6 ? 'left' : 'right';
    }

    var _isSameHand = function(prev, cur) {
        var prevHand = _getHand(prev);
        var curHand = _getHand(cur);
        return prevHand == curHand;
    }
}]);