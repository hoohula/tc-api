/*
 * Copyright (C) 2013 TopCoder Inc., All Rights Reserved.
 *
 * @version 1.0
 * @author TCSASSEMBLER
 */
"use strict";
/*global describe, it, before, beforeEach, after, afterEach, __dirname */
/*jslint node: true, stupid: true, unparam: true */

/**
 * Module dependencies.
 */
var request = require('supertest');
var assert = require('chai').assert;
var async = require('async');
var testHelper = require('./helpers/testHelper');

var API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:8080';
var DATABASE_NAME = "tcs_catalog";

describe('Test Contests API', function () {
    this.timeout(60000); // The api with testing remote db could be quit slow


    /**
     * Clear database
     * @param {Function<err>} done the callback
     */
    function clearDb(done) {
        testHelper.runSqlFile(__dirname + "/sqls/contests/clean.sql", DATABASE_NAME, done);
    }

    /**
     * This function is run before all tests.
     * Generate tests data.
     * @param {Function<err>} done the callback
     */
    before(function (done) {
        async.waterfall([
            clearDb,
            function (cb) {
                testHelper.runSqlFile(__dirname + "/sqls/contests/init_data.sql", DATABASE_NAME, cb);
            },
            function (cb) {
                var files = [], prefix = __dirname + "/sqls/contests/data", generatePath;
                //shortcut for testHelper.generatePartPaths
                generatePath = function (name, count) {
                    return testHelper.generatePartPaths(prefix + "/" + name, "sql", count);
                };
                files = files
                    .concat(generatePath("software-active-contests", 4))
                    .concat(generatePath("software-past-contests", 4))
                    .concat(generatePath("software-upcoming-contests", 4))
                    .concat(generatePath("software-active-private", 1))
                    .concat(generatePath("software-past-private", 1))
                    .concat(generatePath("software-upcoming-private", 1))
                    .concat(generatePath("software-details-contests", 1))
                    .concat(generatePath("studio-active-contests", 4))
                    .concat(generatePath("studio-past-contests", 4))
                    .concat(generatePath("studio-upcoming-contests", 4))
                    .concat(generatePath("studio-active-private", 1))
                    .concat(generatePath("studio-past-private", 1))
                    .concat(generatePath("studio-upcoming-private", 1))
                    .concat(generatePath("studio-details-contests", 1));
                testHelper.runSqlFiles(files, DATABASE_NAME, cb);
            }
        ], done);

    });

    /**
     * This function is run after all tests.
     * Clean up all data.
     * @param {Function<err>} done the callback
     */
    after(function (done) {
        clearDb(done);
    });

    /**
     * Add leading zero to number if less than 10
     * @param {Number} nr the number to format
     * @return {String} number with padding
     */
    function padNumber(nr) {
        if (nr < 10) {
            return "0" + nr;
        }
        return String(nr);
    }

    /**
     * Assert contest properties.
     * Contests are generated by pattern that depends on nr, isStudio, type and details parameters.
     * @param {Object} contest - the contest to check
     * @param {Number} nr - the contest generation number
     * @param {Boolean} isStudio - true if studio contest, false if software
     * @param {String} type - the contest type: "ACTIVE", "OPEN", "PAST" or "UPCOMING"
     * @param {Boolean} details - true if contests has details
     */
    function assertContest(contest, nr, isStudio, type, details) {
        var expectedContestName, expectedCatalog, expectedType, expectedCmc, cmcMod, errMsg;
        //include contest details to error message
        errMsg = "(nr: " + nr + ", isStudio: " + isStudio + ", type: " + type + ", details: " + details + ")";
        expectedContestName = "this is ";
        if (details) {
            expectedContestName = "this is DETAIL ";
        }
        if (isStudio) {
            expectedContestName = expectedContestName + "studio ";
            expectedType = nr % 2 ? "Print/Presentation" : "Idea Generation";
            expectedCatalog = nr % 2 ? "Type8" : "Type3";
        } else {
            expectedContestName = expectedContestName + "software ";
            expectedType = nr % 2 ? "Design" : "Development";
            expectedCatalog = nr % 2 ? "Type16" : "Type22";
        }

        if (type === "ACTIVE" || type === "OPEN") {
            expectedContestName = expectedContestName + "ACTIVE/OPEN ";
        }
        if (type === "PAST") {
            expectedContestName = expectedContestName + "PAST ";
        }
        if (type === "UPCOMING") {
            expectedContestName = expectedContestName + "UPCOMING ";
        }
        expectedContestName = expectedContestName + "contest " + padNumber(nr);
        if (type === "UPCOMING") {
            expectedContestName = expectedContestName + " 1.0";
        }
        cmcMod = (nr - 1) % 4;
        if (cmcMod === 0) {
            expectedCmc = "ab";
        } else if (cmcMod === 1) {
            expectedCmc = "bc";
        } else if (cmcMod === 2) {
            expectedCmc = "cd";
        } else {
            expectedCmc = "de";
        }

        assert.equal(expectedContestName, contest.contestName, "Invalid contestName" + errMsg);
        assert.equal(expectedCatalog, contest.catalog, "Invalid catalog" + errMsg);
        assert.equal(expectedType, contest.type, "Invalid type" + errMsg);
        assert.equal(expectedCmc, contest.cmc, "Invalid cmc" + errMsg);
        if (type === "UPCOMING") {
            assert.equal(0, contest.numberOfSubmissions, "Invalid numberOfSubmissions" + errMsg);
            assert.equal(0, contest.numberOfRatedRegistrants, "Invalid numberOfRatedRegistrants" + errMsg);
            assert.equal(0, contest.numberOfUnratedRegistrants, "Invalid numberOfUnratedRegistrants" + errMsg);
        } else {
            assert.equal(1, contest.numberOfSubmissions, "Invalid numberOfSubmissions" + errMsg);
            assert.equal(1, contest.numberOfRatedRegistrants, "Invalid numberOfRatedRegistrants" + errMsg);
            assert.equal(1, contest.numberOfUnratedRegistrants, "Invalid numberOfUnratedRegistrants" + errMsg);
        }
        assert.equal(510, contest.digitalRunPoints, "Invalid digitalRunPoints" + errMsg);
        assert.equal(200 + (nr - 1) * 2, contest.reliabilityBonus, "Invalid reliabilityBonus" + errMsg);
        assert.ok(contest.contestId, "Invalid contestId" + errMsg);
        assert.ok(contest.projectId, "Invalid projectId" + errMsg);
        assert.ok(new Date(contest.registrationEndDate).toString() !== "InvalidDate",
            "Invalid registrationEndDate" + errMsg);
        assert.ok(new Date(contest.submissionEndDate).toString() !== "InvalidDate",
            "Invalid submissionEndDate" + errMsg);
        assert.ok(contest.prize, "Invalid prize" + errMsg);
        assert.ok(contest.prize.length, "Invalid prize.length" + errMsg);
        if (isStudio && !details) {
            assert.equal(3, contest.prize.length, "Invalid prize.length" + errMsg);
        } else {
            assert.equal(2, contest.prize.length, "Invalid prize.length" + errMsg);
        }
        assert.ok(!contest.description, "Invalid description" + errMsg);
    }

    /**
     * Assert response from given url.
     * It always expect 50 records
     * @param {String} type - the contest type: "ACTIVE", "OPEN", "PAST", "UPCOMING"
     * @param {Boolean} isStudio - true if studio contest, false if software
     * @param {Function<err>} done the callback
     */
    function assertCollection(type, isStudio, done) {
        request(API_ENDPOINT)
            .get('/v2/' + (isStudio ? 'design' : 'develop') + '/challenges?listType=' + type)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
                assert.ifError(err);
                var body = res.body, i, hasDatails = type === "OPEN" || type === "ACTIVE";
                assert.equal(body.total, 50);
                assert.equal(body.pageIndex, 1);
                assert.equal(body.pageSize, 50);
                assert.ok(body.data);
                assert.equal(body.data.length, 50);
                if (hasDatails) {
                    assertContest(body.data[0], 1, isStudio, type, true);
                    for (i = 1; i < 50; i = i + 1) {
                        assertContest(body.data[i], i, isStudio, type, false);
                    }
                } else {
                    for (i = 0; i < 50; i = i + 1) {
                        assertContest(body.data[i], i + 1, isStudio, type, false);
                    }
                }
                done();
            });
    }

    /**
     * Assert cmc value in response from given url.
     * @param {String} type - the contest type: "ACTIVE", "OPEN", "PAST", "UPCOMING"
     * @param {Boolean} isStudio - true if studio contest, false if software
     * @param {Number} size - the count of expected elements
     * @param {String} cmc - the cmc to assert
     * @param {Function<err>} done the callback
     */
    function assertCMC(type, isStudio, size, cmc, done) {
        request(API_ENDPOINT)
            .get('/v2/' + (isStudio ? 'design' : 'develop') + '/challenges?listType=' + type + "&cmc=" + cmc)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
                assert.ifError(err);
                var body = res.body, i;
                assert.equal(body.total, size);
                assert.ok(body.data);
                assert.equal(body.data.length, size);

                for (i = 0; i < size; i = i + 1) {
                    assert.equal(body.data[i].cmc, cmc);
                }
                done();
            });
    }

    /**
     * Assert contests details.
     * @param {Number} contestId - the contest id
     * @param {String} contestName - the contest name to assert
     * @param {Function<err>} done the callback
     */
    function assertContestDetails(contestId, contestName, done) {
        request(API_ENDPOINT)
            .get('/v2/develop/challenges/' + contestId)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
                assert.ifError(err);
                var contest = res.body, errMsg = "(contest: " + contestId + ")";
                assert.ok(contest);
                assert.equal(contest.contestName, contestName, "Invalid contestName " + errMsg);
                assert.ok(contest.type, "Invalid type " + errMsg);
                assert.ok(contest.description || contest.description === "", "Invalid description " + errMsg);
                assert.ok(contest.numberOfSubmissions, "Invalid numberOfSubmissions " + errMsg);
                assert.ok(contest.numberOfRegistrants, "Invalid numberOfRegistrants " + errMsg);
                assert.ok(contest.numberOfPassedScreeningSubmissions,
                    "Invalid numberOfPassedScreeningSubmissions " + errMsg);
                assert.equal(contest.contestId, contestId, "Invalid contestId " + errMsg);
                assert.ok(contest.projectId, "Invalid projectId " + errMsg);
                assert.ok(new Date(contest.registrationEndDate).toString() !== "InvalidDate",
                    "Invalid registrationEndDate" + errMsg);
                assert.ok(new Date(contest.submissionEndDate).toString() !== "InvalidDate",
                    "Invalid submissionEndDate" + errMsg);
                assert.ok(contest.prize, "Invalid prize " + errMsg);
                assert.ok(!isNaN(contest.milestonePrize), "Invalid milestonePrize " + errMsg);
                assert.ok(!isNaN(contest.milestoneNumber), "Invalid milestoneNumber " + errMsg);
                assert.ok(!isNaN(contest.reliabilityBonus), "Invalid reliabilityBonus " + errMsg);
                assert.ok(!isNaN(contest.digitalRunPoints), "Invalid digitalRunPoints " + errMsg);
                assert.ok(contest.submissions, "Invalid submissions " + errMsg);
                assert.ok(contest.registrants, "Invalid registrants " + errMsg);
                assert.ok(contest.cmc || contest.cmc === "", "Invalid cmc " + errMsg);
                done();
            });
    }

    /**
     * Assert contests details are not found
     * @param {Number} contestId - the contest id
     * @param {Function<err>} done the callback
     */
    function assertContestDetailsNotFound(contestId, done) {
        request(API_ENDPOINT)
            .get('/v2/develop/challenges/' + contestId)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(done);
    }

    /**
     * Tests for studio contests
     */
    describe('-- Studio Contests API --', function () {

        /**
         * Test design/challenges?listType=active
         */
        it('should return 50 ACTIVE contests', function (done) {
            assertCollection("ACTIVE", true, done);
        });

        /**
         * Test design/challenges?listType=open
         */
        it('should return 50 OPEN contests', function (done) {
            assertCollection("OPEN", true, done);
        });

        /**
         * Test design/challenges?listType=past
         */
        it('should return 50 PAST contests', function (done) {
            assertCollection("PAST", true, done);
        });

        /**
         * Test design/challenges?listType=upcoming
         */
        it('should return 50 UPCOMING contests', function (done) {
            assertCollection("UPCOMING", true, done);
        });

        /**
         * Test design/challenges?listType=active&cmc=ab
         */
        it('should return 14 ACTIVE contests with cmc=ab', function (done) {
            assertCMC("ACTIVE", true, 14, "ab", done);
        });

        /**
         * Test design/challenges?listType=open&cmc=ab
         */
        it('should return 14 OPEN contests with cmc=ab', function (done) {
            assertCMC("OPEN", true, 14, "ab", done);
        });

        /**
         * Test design/challenges?listType=past&cmc=ab
         */
        it('should return 13 PAST contests with cmc=ab', function (done) {
            assertCMC("PAST", true, 13, "ab", done);
        });

        /**
         * Test design/challenges?listType=upcoming&cmc=ab
         */
        it('should return 13 UPCOMING contests with cmc=ab', function (done) {
            assertCMC("UPCOMING", true, 13, "ab", done);
        });
    });

    /**
     * Tests for Studio contest detail
     */
    describe('-- Contest Detail API --', function () {

        /**
         * develop/challenges/30500002
         */
        it('should return studio contest details', function (done) {
            assertContestDetails(30500002, "this is DETAIL studio ACTIVE/OPEN contest 01", done);
        });

        /**
         * develop/challenges/30400000
         */
        it('should return PAST studio details', function (done) {
            assertContestDetails(30400000, "this is DETAIL software ACTIVE/OPEN contest 01", done);
        });

        /**
         * develop/challenges/31210000
         * develop/challenges/31200000
         * develop/challenges/31220000
         * develop/challenges/31300000
         * develop/challenges/31310000
         * develop/challenges/31320002
         */
        it('should return 404 when access PRIVATE contest', function (done) {
            async.series([
                function (cb) {
                    assertContestDetailsNotFound(31210000, cb);
                },
                function (cb) {
                    assertContestDetailsNotFound(31200000, cb);
                },
                function (cb) {
                    assertContestDetailsNotFound(31220000, cb);
                },
                function (cb) {
                    assertContestDetailsNotFound(31300000, cb);
                },
                function (cb) {
                    assertContestDetailsNotFound(31310000, cb);
                },
                function (cb) {
                    assertContestDetailsNotFound(31320002, cb);
                }
            ], done);
        });
    });

    /**
     * Tests for software contests
     */
    describe('-- Software Contests API --', function () {

        /**
         * Test develop/challenges?listType=active
         */
        it('should return 50 ACTIVE contests', function (done) {
            assertCollection("ACTIVE", false, done);
        });

        /**
         * Test develop/challenges?listType=open
         */
        it('should return 50 OPEN contests', function (done) {
            assertCollection("OPEN", false, done);
        });

        /**
         * Test develop/challenges?listType=past
         */
        it('should return 50 PAST contests', function (done) {
            assertCollection("PAST", false, done);
        });

        /**
         * Test develop/challenges?listType=upcoming
         */
        it('should return 50 UPCOMING contests', function (done) {
            assertCollection("UPCOMING", false, done);
        });


        /**
         * Test develop/challenges?listType=active&cmc=ab
         */
        it('should return 14 ACTIVE contests with cmc=ab', function (done) {
            assertCMC("ACTIVE", false, 14, "ab", done);
        });

        /**
         * Test develop/challenges?listType=open&cmc=ab
         */
        it('should return 14 OPEN contests with cmc=ab', function (done) {
            assertCMC("OPEN", false, 14, "ab", done);
        });

        /**
         * Test develop/challenges?listType=past&cmc=ab
         */
        it('should return 13 PAST contests with cmc=ab', function (done) {
            assertCMC("PAST", false, 13, "ab", done);
        });

        /**
         * Test develop/challenges?listType=upcoming&cmc=ab
         */
        it('should return 13 UPCOMING contests with cmc=ab', function (done) {
            assertCMC("UPCOMING", false, 13, "ab", done);
        });
    });


});