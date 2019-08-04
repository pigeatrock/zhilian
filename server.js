const request = require('request');
const Datastore = require('nedb');
const puppeteer = require('puppeteer');
const pm2 = require('pm2');

// var db = {};
// db.test = new Datastore({ filename: 'data/test.db', autoload: true });        //测试
// db.setting = new Datastore({ filename: 'data/setting.db', autoload: true });  //设置
// db.user = new Datastore({ filename: 'data/user.db', autoload: true });        //账号信息
// db.resume = new Datastore({ filename: 'data/resume.db', autoload: true });    //简历

const MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
const url = "mongodb://localhost:27017";
const dbName = "zhaopin";

//连接数据库
function connectDb() {
  return new Promise((resolve, reject) => {
    MongoClient.connect(url, function (err, client) {
      if (err) {
        console.log('connectDb_err: ', err)
        reject(err)
      } else {
        var db = client.db(dbName);
        resolve({ db, client })
      }
    })
  })
}


// Methods OS.js server requires
module.exports = (core, proc) => ({

  // When server initializes
  init: async () => {
    console.log('server initializes');
    // WebSocket Route example (see index.js)
    core.app.ws(proc.resource('/socket'), (ws, req) => {
      ws.send('Hello World');
      ws.on('message', (args) => {
        console.log('args: ', args)
        ws.send(args)
      })
    });

    //测试
    core.app.ws(proc.resource('/login1'), (ws, req) => {
      var name = '';
      var password = '';
      var phone = '';
      var code = ''; //手机验证码
      ws.on('message', async (args) => {
        console.log('body: ', args);
        var body = JSON.parse(args);
        name = body.name;
        password = body.password;
        phone = body.phone;
        if ((name && password && phone) == '') {
          ws.send(JSON.stringify({ code: 1, msg: '值不能为空，请重新填写' }))
        } else {
          ws.send(JSON.stringify({ code: 2, msg: '请输入手机验证码!' }))
        }
      })

    })

    //访问简历
    // core.app.post(proc.resource('/get-resume'), (req, res) => {
    //   connectDb().then(({ db, client }) => {
    //     var resumeColl = db.collection('resume');
    //     resumeColl.find({}, { projection: { '_id': 0, 'userName': 1, 'jobTitleCity': 1, 'age': 1, 'workYears': 1, 'eduLevel': 1, 'school': 1, 'lastJob': 1, 'resumeSourceName': 1, 'createTime': 1 } }).toArray(function (err, docs) {
    //       if (err) {
    //         console.log('err_getResume: ', err)
    //         res.json({ code: 0, msg: '操作失败' })
    //       } else {
    //         res.json(docs);
    //         client.close();
    //       }
    //     })
    //   })
    // });

    //账号列表
    core.app.post(proc.resource('/account-list'), async (req, res) => {
      connectDb().then(({ db, client }) => {
        var accountList = db.collection('user');
        accountList.find({}, { projection: { '_id': 1, 'name': 1 } }).toArray(function (err, docs) {
          if (err) {
            console.log('err_accountList: ', err)
            res.json({ code: 0, msg: '操作失败' })
          } else {
            res.json(docs);
            client.close();
          }
        })
      })
    })

    //账号相应组织机构
    core.app.post(proc.resource('/org-list'), async (req, res) => {
      let _id = req.body.id;
      connectDb().then(({ db, client }) => {
        var accountList = db.collection('user');
        accountList.find({ _id: ObjectID(_id) }).toArray(function (err, docs) {
          if (err) {
            console.log('err_orgList: ', err)
            res.json({ code: 0, msg: '操作失败' })
          } else {
            res.json(docs[0]);
            client.close();
          }
        })
      })
    })

    //组织机构对应账号
    function getName(orgId) {
      return new Promise((resolve, reject) => {
        connectDb().then(({ db, client }) => {
          var user = db.collection('user');
          user.find({ "orgInfo.orgId": orgId }).toArray(function (err, docs) {
            if (err) {
              console.log('getName_err: ', err)
              reject(err);
            } else {
              resolve(docs[0]);
            }
          })
        })
      })
    }

    //组织机构相应简历
    core.app.post(proc.resource('/org-resume'), async (req, res) => {
      let orgId = req.body.id;
      let name = await getName(orgId);
      connectDb().then(({ db, client }) => {
        var resumeList = db.collection('resume_' + name.name);
        resumeList.find({ orgId }, { projection: { '_id': 0, 'userName': 1, 'jobTitleCity': 1, 'age': 1, 'workYears': 1, 'eduLevel': 1, 'school': 1, 'lastJob': 1, 'resumeSourceName': 1, 'createTime': 1 } }).toArray(function (err, docs) {
          if (err) {
            console.log('err_getResume: ', err)
            res.json({ code: 0, msg: '操作失败' })
          } else {
            res.json(docs);
            client.close();
          }
        })
      })
    })

    //删除账号
    core.app.post(proc.resource('del-account'), async (req, res) => {
      let _id = req.body.id;
      console.log('删除账号');
      connectDb().then(({ db, client }) => {
        var accountList = db.collection('user');
        accountList.deleteOne({ _id: ObjectID(_id) }, function (err, result) {
          if (err) {
            console.log('err: ', err)
            res.json({ code: 0, msg: '删除失败' })
          } else {
            res.json({ code: 0, msg: '删除成功' })
          }
          client.close();
        }).catch((err) => {
          console.log('err: ', err);
        })
      })
    })

    //任务列表
    core.app.post(proc.resource('/task-list'), async (req, res) => {
      connectDb().then(({ db, client }) => {
        var taskList = db.collection('task');
        taskList.find({}).toArray(function (err, docs) {
          if (err) {
            console.log('err_taskList', err)
            res.json({ code: 0, msg: '操作失败' })
          } else {
            res.json(docs);
            client.close();
          }
        })
      })
    })
    //保存任务
    core.app.post(proc.resource('/add-task'), async (req, res) => {
      let taskName = req.body.taskName;
      let bindAccount = req.body.bindAccount;
      let cycleTime = req.body.cycleTime;
      let addTime = new Date().toLocaleString();
      console.log('body: ', req.body);
      console.log('添加任务');
      connectDb().then(({ db, client }) => {
        var taskList = db.collection('task');
        taskList.insertMany([
          {
            taskName, bindAccount, cycleTime, addTime
          }
        ], function (err, result) {
          if (err) {
            console.log('err: ', err)
            res.json({ code: 0, msg: '操作失败' })
          }
          client.close();
          res.json({ code: 0, msg: '添加成功' })
        })
      })
    })
    //删除任务
    core.app.post(proc.resource('/del-task'), async (req, res) => {
      let _id = req.body.id;
      console.log('删除任务');
      // console.log('req.body: ', req.body)
      connectDb().then(({ db, client }) => {
        var taskList = db.collection('task');
        taskList.deleteOne({ _id: ObjectID(_id) }, function (err, result) {
          if (err) {
            console.log('err: ', err)
            res.json({ code: 0, msg: '操作失败' })
          }
          client.close();
          res.json({ code: 0, msg: '删除成功' })
        })
      }).catch((err) => {
        console.log('err: ', err)
      })
    })
    //编辑任务
    core.app.post(proc.resource('/edit-task'), async (req, res) => {
      let _id = req.body.id;
      let taskName = req.body.taskName;
      let bindAccount = req.body.bindAccount;
      let cycleTime = req.body.cycleTime;
      console.log('编辑任务');
      connectDb().then(({ db, client }) => {
        var taskList = db.collection('task');
        taskList.updateOne({ _id }, { $set: { taskName, bindAccount, cycleTime } }, function (err, result) {
          if (err) {
            console.log('err: ', err)
            res.json({ code: 0, msg: '操作失败' })
          }
          client.close();
          res.json({ code: 0, msg: '编辑成功' })
        })
      })
    })

    //获取简历详情
    // core.app.post(proc.resource('/get-remdetail'),(req,res)=>{
    //   MongoClient.connect(url,function(err,client){
    //     console.log('连接简历详情数据库成功');
    //     var db = client.db(dbName);
    //     var resumeDil = db.collection('resumeDetail');

    //   })
    // })


    //智联账号登录
    core.app.ws(proc.resource('/login2'), async (ws, req) => {
      //puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null
      });
      console.log('puppeteer已经启动！')
      //抓取cookie并存入数据库nedb
      // async function saveCookies1() {
      //   var cookies = await page.cookies();
      // }
      //抓取cookie并存入数据库mongodb
      async function saveCookies(name, phone, cookie, orgInfo) {
        connectDb().then(({ db, client }) => {
          var collection = db.collection('user');
          collection.insertMany([
            {
              name,
              phone,
              cookie,
              orgInfo
            }
          ], function (err, result) {
            if (err) {
              console.log('err: ', err)
            }
            client.close();
          })
        })
      }
      //延迟函数
      var timeout = function (delay) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            try {
              resolve(1)
            } catch (e) {
              reject(0)
            }
          }, delay)
        })
      }
      var page = await browser.newPage();
      var times = 0;  //重新执行滑动的次数
      const distanceError = [-10, 2, 3, 5]; //距离误差

      await page.goto('https://passport.zhaopin.com/org/login');
      var pageUrl = page.url(); //当前网页url

      //计算按钮需要滑动的距离
      async function calculateDistance() {
        console.log('calculateDistance开始执行')
        try {
          var distance = await page.evaluate(() => {
            //比较像素，找到缺口的大概位置
            const ctx1 = document.querySelector('.geetest_canvas_fullbg'); // 完整图片
            const ctx2 = document.querySelector('.geetest_canvas_bg');  // 带缺口图片
            var ctx1Context = ctx1.getContext("2d");
            var ctx2Context = ctx2.getContext("2d");
            const pixelDifference = 30; //像素差
            let res = [];   //保存像素差较大的x坐标
            // //对比像素
            for (let i = 57; i < 260; i++) {
              for (let j = 1; j < 160; j++) {
                const imgData1 = ctx1Context.getImageData(1 * i, 1 * j, 1, 1);
                const imgData2 = ctx2Context.getImageData(1 * i, 1 * j, 1, 1);
                const data1 = imgData1.data;
                const data2 = imgData2.data;
                const res1 = Math.abs(data1[0] - data2[0]);
                const res2 = Math.abs(data1[1] - data2[1]);
                const res3 = Math.abs(data1[2] - data2[2]);
                if (!(res1 < pixelDifference && res2 < pixelDifference && res3 < pixelDifference)) {
                  if (!res.includes(i)) {
                    res.push(i);
                  }
                }
              }
            }
            // 返回像素差最大值跟最小值，经过调试最小值往左小7像素，最大值往左54像素
            return { min: res[0] - 7, max: res[res.length - 1] - 54 }
          })
          return distance;
        } catch (e) {
          console.log('calculateDistance: ', e);
        }
      }

      //计算滑块位置
      async function getBtnPosition() {
        const btn_posotion = await page.evaluate(() => {
          const { left, top, width, height } = document.querySelector('.geetest_slider_button').getBoundingClientRect();
          return { btn_left: left + width / 2, btn_top: top + height / 2 }
        })
        return btn_posotion;
      }

      //尝试滑动按钮
      async function tryValidation(distance) {
        console.log('开始滑动')
        //将距离拆成两段，模拟正常人的行为
        const distance1 = distance - 10;
        const distance2 = 10;

        var btn_position = await getBtnPosition();
        page.mouse.click(btn_position.btn_left, btn_position.btn_top, { delay: 200 })
        page.mouse.down(btn_position.btn_left, btn_position.btn_top)
        page.mouse.move(btn_position.btn_left + distance1, btn_position.btn_top, { steps: 30 })
        await timeout(200);
        page.mouse.move(btn_position.btn_left + distance1 + distance2, btn_position.btn_top, { steps: 20 })
        await timeout(200);
        page.mouse.up()
        await timeout(1000);
        try {
          var reDistance = await page.evaluate(() => {
            return document.querySelector('.geetest_result_content') && document.querySelector('.geetest_result_content').innerHTML
          })
        } catch (e) {
          console.log('e: ', e)
        }
        return { reDistance: reDistance.includes('怪物吃了拼图') }
      }

      //账号密码拖动滑块
      async function drag(distance) {
        console.log('drag开始滑动')
        distance = distance || await calculateDistance();
        if (isNaN(distance.max)) {
          console.log('distance计算出错，请重试')
          return 1;
        }
        console.log('distance: ', distance);
        var result = await tryValidation(distance.min)
        await timeout(1000);
        if (pageUrl == page.url()) {
          if (result.reDistance) {
            console.log('重新计算，重新滑动')
            times = 0;
            await drag(null);
          } else if (distanceError[times]) {
            times++
            console.log('重新滑动');
            await drag({ min: distance.max, max: distance.max + distanceError[times] })
          }
        }
      }

      //手机号验证
      async function drag2(distance) {
        console.log('drag2开始滑动');
        distance = distance || await calculateDistance();
        if (isNaN(distance.max)) {
          console.log('distance计算出错，请重试')
          return 1;
        }
        console.log('distance: ', distance);
        var resule = await tryValidation(distance.min)
        await timeout(2000);
        var code_timer = await page.evaluate(() => {
          return document.querySelector('.zp-passport-widget-b-login-sms__code-time').innerText == 60
        })
        if (code_timer) {
          if (resule.reDistance) {
            console.log('重新计算，重新滑动')
            times = 0;
            await drag2(null);
          } else if (distanceError[times]) {
            times++
            console.log('重新滑动')
            await drag2({ min: distance.max, max: distance.max + distanceError[times] })
          }
        }
      }

      ws.on('message', async (args) => {
        console.log('args: ', args);
        var data = JSON.parse(args);
        if (data.type == 'body') {
          name = data.name;
          password = data.password;
          phone = data.phone;
          if ((name && password && phone) == '') {
            ws.send(JSON.stringify({ code: 1, msg: '值不能为空，请重新填写' }))
          } else { //登录
            //输入账号密码登录
            await page.type('input[name=username]', name, { delay: 20 });
            await page.type('input[name=password]', password, { delay: 20 });
            var loginBtn = await page.$('.k-form .k-button');
            // await page.waitForNavigation();
            await loginBtn.click();
            await page.waitFor(2000);
            //判断是否跳转页面
            if (page.url() != pageUrl) {
              console.log('账号登录页面没有滑块----------------')
              await page.type('.zp-passport-widget-b-login-sms__number', phone, { delay: 20 });
              var codeBtn = await page.$('.bind-phone .zp-passport-widget-b-login-sms__send-code');
              await codeBtn.click();
              await page.waitFor(2000);
              //判断是否有滑块验证
              var loginSlider = await page.$('.geetest_panel_box.geetest_panelshowslide')
              if (loginSlider) {
                console.log('有滑块-----------')
                //滑动
                if (await drag2(null)) {
                  ws.send(JSON.stringify({ code: 0, msg: 'distance计算出错，请重试程序' }))
                  return;
                };
                //等待输入验证码
                ws.send(JSON.stringify({ code: 2, msg: '稍后请输入手机验证码!' }))
              } else {
                console.log('没有滑块------------')
                //等待输入验证码
                ws.send(JSON.stringify({ code: 2, msg: '稍后请输入手机验证码!' }))
              }
            } else {
              console.log('账号登录页面有滑块-----------')
              //滑动
              await drag(null);
              console.log('drag后执行');
              await timeout(2000);
              console.log('手机号验证')
              await page.type('.zp-passport-widget-b-login-sms__number', phone, { delay: 20 });
              var codeBtn = await page.$('.bind-phone .zp-passport-widget-b-login-sms__send-code');
              await codeBtn.click();
              await timeout(2000);
              //判断是否有滑块验证
              var loginSlider2 = await page.$('.geetest_panel_box.geetest_panelshowslide')
              if (loginSlider2) {
                console.log('有滑块-----------')
                //滑动
                if (await drag2(null)) {
                  ws.send(JSON.stringify({ code: 0, msg: 'distance计算出错，请重试程序' }))
                  return;
                };
                //等待输入验证码
                ws.send(JSON.stringify({ code: 2, msg: '稍后请输入手机验证码!' }))
              } else {
                console.log('没有滑块------------')
                //等待输入验证码
                ws.send(JSON.stringify({ code: 2, msg: '稍后请输入手机验证码!' }))
              }
            }

          }
        } else if (data.type == 'code') {
          var code = data.code;
          await page.type('input.zp-passport-widget-b-login-sms__code', code, { delay: 30 });
          var codeBtn = await page.$('.zp-passport-widget-b-login-sms__submit');
          // await page.waitForNavigation();
          await codeBtn.click();
          await page.waitFor(2000);
          /*获取机构信息*/
          var orgNum = await page.evaluate(() => { //数量
            return document.querySelector('.org-list').childElementCount;
          })
          console.log('orgNum: ', orgNum);
          var orgInfo = [];
          for (let i = 0; i < orgNum; i++) {
            let str = `.org-list li:nth-of-type(${i + 1}) a`;
            let orgName = await page.$eval(str, el => el.innerHTML);
            let orgId = await page.$eval(str, el => el.getAttribute('orgid'));
            await page.click(`.org-list li:nth-of-type(${i + 1}) a`);
            await page.waitFor(2000);
            let cookie = await page.evaluate(() => document.cookie);
            orgInfo.push({
              orgName, orgId, "cookie": cookie
            });
            await page.goBack();
          }
          //获取cookie
          await page.click(`.org-list li:nth-of-type(1) a`);
          await page.waitFor(2000);
          var orgCookie = await page.evaluate(() => document.cookie); //cookie

          await saveCookies(name, phone, orgCookie, orgInfo);
          browser.close()
          return ws.send(JSON.stringify({ code: 3, msg: '登录成功' }));
        }
      })//message
    })
  },

  // When server starts
  start: () => {
    //执行爬取任务
    console.log('zhaopin server starts');
    console.log('开始执行爬取任务----------')
    pm2.connect(function (err) {
      if (err) {
        console.error(err);
        process.exit(2);
      }
      function makeTask() {
        pm2.list((err, procList) => {
          if (err) {
            console.log('err: ', err);
          } else {
            var procList_tmp = [];
            for (let m = 0; m < procList.length; m++) {
              procList_tmp.push(procList[m].name);
            }
            // console.log('proc: ',proc)
            //轮询任务
            connectDb().then(({ db, client }) => {
              var taskList = db.collection('task');
              taskList.find({}).toArray(function (err, docs) {
                if (err) {
                  console.log('err: ', err)
                } else if (docs.length == 0) {
                  return;
                } else {
                  var docs_tmp = [];
                  var docs_tmp1 = [];
                  for (let n = 0; n < docs.length; n++) {
                    docs_tmp.push(docs[n].bindAccount);
                    docs_tmp1.push('zhilianzhaopin_' + docs[n].bindAccount);
                  }
                  //查询是否有多余任务
                  for (let i = 0; i < procList_tmp.length; i++) {
                    if (!docs_tmp1.includes(procList_tmp[i])) {
                      pm2.delete(procList_tmp[i], (err, res) => {
                        if (err) {
                          console.log('err: ', err)
                        }
                      })
                    }
                  }
                  //查询是否有任务没启动
                  for (let x = 0; x < docs_tmp.length; x++) {
                    if (!procList_tmp.includes(docs_tmp1[x])) {
                      pm2.start({
                        name: docs_tmp1[x],
                        args: [docs_tmp[x], docs[x].cycleTime],
                        script: 'update.js',
                        exec_mode: 'cluster',
                        max_memory_restart: '100M'
                      }, function (err, apps) {
                        if (err) {
                          console.log('err: ', err);
                        }
                      })
                    }
                  }
                }
                client.close();
              })
            })
          }
        })
      }
      setInterval(makeTask, 5000);
    })
  },

  // When server goes down
  destroy: () => {
    console.log('---------------zhaopin:destroy-----------------');
  },
});
