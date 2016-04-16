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
    $scope.calculating = false;
    $scope.listSize = 0;
    $scope.useOriginalDicewareSource = false;
    $scope.weights = {
        sameHand: 0,
        sameRow: -2,
        sameFinger: -5,
        numberRow: -2,
        homeRow: -1,
        requiresShift: -5,
    };
    var _dicewareList = {};
    var _keyboardData = {};

    $scope.init = function() {
        $scope.calculating = true;
        _calculatePasswords().then(function() {
            $scope.calculating = false;
        });
    }

    var _calculatePasswords = function() {
        var error = function(message) {
            return _promise(function(resolve, reject) {
                reject(message);
            });
        }

        return _checkQuota().then(_fetchData, error)
            .then(_mapNumsToPasswords, error)
            .then(_scorePasswords, error)
            .then(function(passwords) {
                $scope.passwords = passwords;
                $scope.areWordsReady = true;
            }, error);
    }

    $scope.recalculate = function() {
        $scope.recalculating = true;
        _calculatePasswords().then(function() {
            $scope.recalculating = false;
        }, function(message) {
            $scope.errorMessage = message;
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
        console.log('_fetchData');
        var numPromise = null;
        var numNums = $scope.passwordWordLength * $scope.numPasswords * 5;

        numPromise = _getDicewareNums(quota, numNums);

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
        console.log('_mapNumsToPasswords');
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
            var dicewareSource = "alternate-diceware-list.txt";
            if ($scope.useOriginalDicewareSource)
                dicewareSource = "diceware-standard.txt";
            $http.get(dicewareSource).then(function(response) {
                var data = response.data;
                var rows = data.split('\n');
                var list = _.reduce(rows, function(m, r) {
                    var splits = r.split('\t');
                    m[splits[0]] = splits[1];
                    return m;
                }, {});
                resolve(list);
            }, function() {
                reject('fetching diceware list failed');
            });
        }); 
    }

    var _generateDicewareNums = function(numNums) {
        var nums = _.chain(_.range(numNums))
            .map(function() {
                return Math.floor(Math.random() * 6 + 1);
            }).value();
        return nums;
    }

    var _getDicewareNums = function(quota, numNums) {
        if (quota >= 500) {
            return $http.get(_getRNGUrl()).then(function(response) {
                var seed = response.data.trim();
                Math.seedrandom(seed);
                dicewareNums = _generateDicewareNums(numNums);
                return dicewareNums;
            });
        } else {
            // error: say something about not using true randomness
            return _promise(function(resolve, reject) {
                resolve(_generateDicewareNums(numNums));
            });
        }
    }

    var _getRNGUrl = function(num) {
        return 'https://www.random.org/integers/?num=1&min=100000000&max=999999999&col=1&base=10&format=plain&rnd=new';
    }

    var _scorePasswords = function(passwords) {
        console.log('_scorePasswords');
        return _promise(function(resolve, reject) {
            _.each(passwords, function(password) {
                var whole = password.words.join('');
                var sum = _.reduce(whole, function(sum, c, i, l) {
                    var score = 5;
                    if (i > 0) {
                        var prev = _keyboardData[l[i - 1]];
                        var cur = _keyboardData[l[i]];
                        if (!_isSameHand(prev, cur)) {
                            score += $scope.weights.sameHand; // 0
                        } else {
                            if (_isSameRow(prev, cur)) {
                                score += $scope.weights.sameRow; // -2
                            }
                            if (_isSameFinger(prev, cur)) {
                                score += $scope.weights.sameFinger; // -5
                            }
                        }

                        if (!_isHomeRow(cur)) {
                            if (_isNumberRow(cur)) {
                                score += $scope.weights.numberRow; // -2
                            } else {
                                score += $scope.weights.homeRow; // -1
                            }
                        }

                        if (_isShiftKey(cur)) {
                            score += $scope.weights.requiresShift; // -5
                        }

                        return score + sum;
                    } else {
                        return 0;
                    }
                }, 0);
                password.score = sum / (whole.length - 1);
                password.score = Math.floor(password.score * 1000);
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
}])
;
