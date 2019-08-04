const request = require('request');

const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017";
const dbName = "zhaopin";

// var name = "changguizhaopin1";
// var cycleTime = 5000;
var name = process.argv[2];
var cycleTime = process.argv[3] || 5000;


MongoClient.connect(url, function (err, client) {
    console.log('mongodb连接成功')
    var db = client.db(dbName);
    var userList = db.collection('user');   //账号列表
    var resumeList = db.collection('resume_' + name); //简历列表
    var resumeDetail = db.collection('resumeDetail_' + name); //简历详情
    var resumeTotal = {}; //简历总量

    //获得相应时间
    function GetDateStr(AddDayCount) {
        var dd = new Date();
        dd.setDate(dd.getDate() + AddDayCount);//获取AddDayCount天后的日期 
        var y = dd.getFullYear();
        var m = dd.getMonth() + 1;//获取当前月份的日期 
        var d = dd.getDate();
        //判断 月
        if (m < 10) {
            m = "0" + m;
        } else {
            m = m;
        }
        //判断 日n     
        if (d < 10) {//如果天数<10
            d = "0" + d;
        } else {
            d = d;
        }
        return (y + m + d).substr(2);
    }
    //获取当前时间
    function getNowFormatDate() {
        var date = new Date();
        var seperator1 = "-";
        var seperator2 = ":";
        var month = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1;
        var strDate = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        var currentdate = date.getFullYear() + seperator1 + month + seperator1 + strDate
            + " " + date.getHours() + seperator2 + date.getMinutes()
            + seperator2 + date.getSeconds();
        return currentdate;
    }

    //获得用户信息
    function getUserInfo(name) {
        return new Promise((resolve, reject) => {
            userList.find({ name: name }).toArray(function (err, docs) {
                if (err) {
                    console.log('getUserInfo_err: ', err)
                    reject(err)
                } else {
                    var cookie = docs[0].cookie;
                    var orgInfo = docs[0].orgInfo;
                    resolve({ cookie, orgInfo })
                }
            })
        })
    }

    //切换组织机构
    function changeLoginPoint(cookie, orgId) {
        // console.log('---------------changeLoginPoint');
        return new Promise((resolve, reject) => {
            var loginPointOptions = {
                url: 'https://ihr.zhaopin.com/loginPoint/saveLoginPoint.do?pointOrgId=' + orgId,
                method: 'get',
                headers: {
                    'cookie': cookie
                }
            }
            request(loginPointOptions, function (err, res, body) {
                // console.log('body: ', body);
                var body1 = JSON.parse(body);
                if (err) {
                    console.log('changeLoginPoint_err: ', err)
                } else if (body1.message != '成功') {
                    reject(body);
                } else {
                    resolve(body);
                }
            })
        })
    }

    //获得简历列表
    function getResumeList(cookie) {
        var endDay = GetDateStr(0);
        var beginDay = GetDateStr(-7);

        var resumeListOptions = {
            url: 'https://rd5.zhaopin.com/api/rd/resume/list',
            method: 'post',
            headers: {
                'Cookie': cookie
            },
            body: JSON.stringify({ "isNewList": true, "sort": "time", "S_ResumeState": "1", "S_CreateDate": `${beginDay, endDay}`, "S_feedback": "", "searchSource": 1, "page": 1, "pageSize": 3 })
        }
        return new Promise((resolve, reject) => {
            request(resumeListOptions, function (err, res, body) {
                if (err) {
                    console.log('err: ', err)
                    reject(err);
                } else {
                    // console.log('cookie: ',cookie)
                    // console.log('resumeList: ',body)
                    resolve(body);
                }
            })
        })
    }

    //获得简历详情
    function getResumeDetail(cookie, resumeNo) {
        return new Promise((resolve, reject) => {
            var resumeDetailOptions = {
                url: 'https://rd5.zhaopin.com/api/rd/resume/detail?resumeNo=' + resumeNo,
                method: 'get',
                headers: {
                    'Cookie': cookie
                }
            }
            request(resumeDetailOptions, function (err, res, body) {
                if (err) {
                    console.log('err: ', err)
                    reject(err);
                } else {
                    resolve(body);
                }
            })
        })
    }

    getUserInfo(name).then(async ({ cookie, orgInfo }) => {

        function task(cookie, orgId) {
            console.log('-----runtask: orgId', orgId, ' ', getNowFormatDate());
            return new Promise((resolve, reject) => {
                //切换组织机构
                changeLoginPoint(cookie, orgId).then(() => {


                    //保存简历（简历列表，简历详情）
                    getResumeList(cookie).then(async (body) => {
                        // console.log('resumeList: ',body)
                        // console.log('resumeTotal[orgId]: ',resumeTotal[orgId])
                        let body1 = JSON.parse(body);
                        let resumeTotal_tmp = body1.data.total;
                        // console.log('resumeTotal: ',resumeTotal_tmp)
                        if (resumeTotal_tmp == 0) return;
                        if (resumeTotal[orgId] == resumeTotal_tmp) {
                            return;
                        } else {
                            console.log('有新的简历!')
                            if (resumeTotal[orgId] == undefined) resumeTotal[orgId] = 0;
                            var resumeNum = Number(resumeTotal_tmp) - Number(resumeTotal[orgId]);
                            if (resumeNum >= 1) {
                                resumeNum = 1;
                            }
                            resumeTotal[orgId] = body1.data.total;
                            var resumeArr = body1.data.dataList.slice(0, resumeNum); //简历列表
                            resumeArr.map((v) => {
                                v['orgId'] = orgId
                            })
                            var resumeDetailArr = [];   //简历详情列表
                            async function getDetailList(cookie, resumeNo) {
                                let body = await getResumeDetail(cookie, resumeNo);
                                let detail = JSON.parse(body).data;
                                detail['orgId'] = orgId
                                resumeDetailArr.push(detail);
                                // console.log('resumeDetail: ', detail)
                            }
                            async function runDetailList() {
                                for (let n = 0; n < resumeArr.length; n++) {
                                    await getDetailList(cookie, resumeArr[n].id);
                                }
                            }

                            await runDetailList();
                            // console.log('resumeArr: ', resumeArr)
                            resumeList.insertMany(resumeArr, function (err, result) {
                                if (err) {
                                    console.log('errresume: ', err)
                                } else {
                                    resumeDetail.insertMany(resumeDetailArr, function (err, result) {
                                        if (err) {
                                            console.log('erresumeDetail: ', err)
                                        } else {
                                            resolve(1);
                                        }
                                    })
                                }
                            })
                        }
                    }).catch((err) => { console.log('err: ', err) })
                })
            })
        }
        // async function run() {
        //     for (let m = 0; m < orgInfo.length; m++) {
        //         await task(cookie, orgInfo[m].orgId)
        //     }
        // }
        async function run() {
            for (let m = 0; m < orgInfo.length; m++) {
                await task(orgInfo[m].cookie, orgInfo[m].orgId)
            }
        }
        //循环执行
        setInterval(run, cycleTime);
        // await run();
    })

})