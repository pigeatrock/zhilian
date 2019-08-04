import { h, app } from 'hyperapp';
import { Box, Tabs, Button, TextField, Toolbar, Menubar, MenubarItem, Statusbar, Panes, listView, Iframe } from '@osjs/gui';
import { TextFieldContainer, SelectFieldContainer } from './gui';
import './index.scss';
import osjs from 'osjs';
import { name as applicationName } from './metadata.json';
// import antd from 'antd';


//转换列表
function changeList(data) {
  var arr = [];
  data.forEach(el => {
    var ar = [];
    for (let ii in el) {
      ar.push(el[ii]);
    }
    arr.push({
      columns: ar
    })
  });
  return arr;
}
function changeList2(data) {
  var arr = [];
  data.forEach(el => {
    var ar = [];
    for (let ii in el) {
      ar.push(el[ii]);
    }
    arr.push({
      columns: ar,
      data: el._id,
    })
  });
  return arr;
}
//2、创建登录窗口
const createLoginWin = (core, proc, win, $content) => {
  // proc.request('/test', { method: 'post' }).then(response => console.log(response));
  const sock = proc.socket('/login2');

  //多步操作
  const steps = [
    (state, actions) =>
      h(Box, { margin: false }, [
        h(TextField, {
          placeholder: '用户名',
          value: state.user.name,
          oninput: (ev) => actions.user.set({ name: ev.target.value })
        }),
        h(TextField, {
          placeholder: '密码',
          value: state.user.password,
          oninput: (ev) => actions.user.set({ password: ev.target.value })
        }),
        h(TextField, {
          placeholder: '手机号',
          value: state.user.phone,
          oninput: (ev) => actions.user.set({ phone: ev.target.value })
        })
      ]),
    (state, actions) =>
      h(Box, {}, [
        h(TextField, {
          placeholder: '短信验证码',
          value: state.user.code,
          oninput: (ev) => actions.user.set({ code: ev.target.value })
        })
      ]),
  ]

  const step = (state, actions) => steps[state.step](state, actions);
  //Hyperapp
  const loginApp = app(
    //state
    {
      step: 0,
      user: {
        name: '',
        password: '',
        phone: '', //手机号
        code: '', //验证码
      },
    },
    //actions
    {
      nextStep: () => state => {
        console.log('state.step: ', state.step)
        if (state.step == 0) {
          let body = { type: 'body', name: state.user.name, password: state.user.password, phone: state.user.phone };
          // Creates a new WebSocket connection (see server.js) 
          sock.send(JSON.stringify(body));
        } else if (state.step == 1) {
          sock.send(JSON.stringify({ type: 'code', code: state.user.code }))
        }
      },
      getStep: () => state => state.step,
      setStep: (value) => state => {
        return { step: value }
      },
      getState: () => state => state,
      user: {
        set: obj => obj,
      },
    },
    //简历视图（默认视图）view
    (state, actions) => {
      const isLastStep = state.step === steps.length - 1;

      return h(Box, {}, [
        h(Box, { //多步视图
          grow: 1,
          shrink: 1
        }, step(state, actions)),
        h(Toolbar, { justify: 'flex-end' }, [
          h(Button, {
            onclick: () => actions.nextStep()
          }, isLastStep ? '完成' : '下一步')
        ]),
      ])
    }, $content);

  //websocket监听
  sock.on('message', (data) => {
    console.log('data: ', data)
    var data = JSON.parse(data.data);
    if (data.code == 1) { //有空值
      core.make('osjs/notification', {
        message: data.msg,
        onclick: () => console.log(data.msg)
      })
    } else if (data.code == 2) {  //登录
      core.make('osjs/notification', {
        message: data.msg,
        onclick: () => console.log(data.msg)
      });
      loginApp.setStep(1)
    } else if (data.code == 3) { //手机短信验证成功
      core.make('osjs/notification', {
        message: data.msg,
        onclick: () => console.log(data.msg)
      });
      win.close();
    } else if (data.code == 0) {
      core.make('osjs/notification', {
        message: data.msg,
        onclick: () => console.log(data.msg)
      });
    }
  })

}

//4、创建账号列表窗口
const accountListWin = async (core, proc, win, $content) => {
  var accountList = await proc.request('/account-list', { method: 'post' });
  var accountBus = core.make('osjs/event-emitter');
  var accountApp = app({
    accountList: listView.state({
      columns: [{
        label: 'id'
      },
      {
        label: '账号'
      },],
      rows: changeList2(accountList),
    })
  }, {
      accountList: listView.actions({
        activate: ({ data }) => {
          // console.log('activate: ', data)
          proc.emit('refreshMain', data)
          win.close();
        },
        contextmenu: ({ data, index, ev }) => {
          // console.log({ data, index, ev });
          accountBus.emit('openAccountMenu', data, ev, win);
        }
      }),
    },
    (state, actions) => {
      //账号列表视图
      const accountList = listView.component(state.accountList, actions.accountList);
      return h(Box, {}, [
        h(accountList),
      ])
    }, $content);
  //监听右键菜单
  accountBus.on('openAccountMenu', (id, ev, win) => {
    core.make('osjs/contextmenu').show({
      position: ev.target,
      menu: [
        {
          label: '删除',
          onclick: ev => {
            core.make('osjs/dialog', 'confirm', {
              message: `是否删除此账号`
            }, (name) => {
              // console.log('name: ',name);
              if (name == 'yes') {
                proc.request('/del-account', { method: 'post', body: { id } }).then(async (data) => {
                  core.make('osjs/notification', {
                    message: data.msg,
                    onclick: () => console.log(data.msg)
                  });
                  let list = await proc.request('/account-list', { method: 'post' }); //账号列表
                  accountApp.accountList.setRows(changeList2(list));
                  win.focus()
                })
              } else {
                console.log('已取消')
                core.make('osjs/notification', {
                  message: '已取消',
                  onclick: () => console.log()
                });
                win.focus()
              }
            })
          }
        }
      ]
    })
  })
}
//3、创建计划任务窗口
const createTaskWin = async (core, proc, win, $content) => {
  var taskBus = core.make('osjs/event-emitter');
  var acccountList = await proc.request('/account-list', { method: 'post' }); //账号列表
  var nameList = [];
  for (let i = 0; i < acccountList.length; i++) {
    nameList.push(acccountList[i].name);
  }

  var taskList = await proc.request('/task-list', { method: 'post' }); //任务列表

  const defaultValues = {
    taskType: '', //任务类型
    taskName: '', //任务名称
    bindAccount: '',//绑定账号
    cycleTime: '',//执行周期
  }
  //Hyperapp
  var taskWin = app(
    //state
    {
      nameList,
      form: defaultValues, //表单默认值
      taskList: listView.state({
        columns: [{
          label: 'id'
        },
        {
          label: '任务名称'
        }, {
          label: '账号'
        }, {
          label: '周期'
        }, {
          label: '添加时间'
        }],
        rows: changeList2(taskList),
      })
    },
    //actions
    {
      save: () => async (state, actions) => {
        // proc.emit('save-form', state.form);
        let data = await proc.request('/add-task', { method: 'post', body: state.form })
        if (data.code == 0) {
          core.make('osjs/notification', {
            message: data.msg,
            onclick: () => console.log(data.msg)
          });
        }
        actions.reset();
        let list = await proc.request('/task-list', { method: 'post' }); //任务列表
        actions.taskList.setRows(changeList2(list))
      },
      reset: () => {
        return { form: defaultValues };
      },
      taskList: listView.actions({
        contextmenu: ({ data, index, ev }) => {
          console.log({ data, index, ev });
          taskBus.emit('openTaskMenu', data, ev);
        }
      }),
      form: {
        set: obj => obj,
      }
    },
    //view
    (state, actions) => {
      //任务列表视图
      const taskList = listView.component(state.taskList, actions.taskList);

      return h(Box, {}, [
        h(Box, {}, [
          h(SelectFieldContainer, {
            name: 'taskType',
            label: '任务类型',
            choices: ['智联主投'],
          }),
          h(SelectFieldContainer, {
            name: 'bindAccount',
            label: '绑定账号',
            choices: nameList,
            onchange: (ev) => actions.form.set({ bindAccount: ev.target.value })
          }),
          h(TextFieldContainer, {
            name: 'taskName',
            label: '任务名称',
            oninput: (ev) => {
              // console.log('value: ', ev.target.value)
              actions.form.set({ taskName: ev.target.value })
            },
          }),
          h(TextFieldContainer, {
            name: 'cycleTime',
            label: '执行周期',
            oninput: (ev) => actions.form.set({ cycleTime: ev.target.value }),
          }),
          h(Toolbar, { justify: 'flex-end' }, [
            h(Button, { onclick: () => actions.save() }, '添加任务')
          ])
        ]),
        h(taskList),
      ])
    }, $content);

  //监听右键菜单
  taskBus.on('openTaskMenu', (id, ev) => {
    core.make('osjs/contextmenu').show({
      position: ev.target,
      menu: [
        {
          label: '删除',
          onclick: ev => proc.request('/del-task', { method: 'post', body: { id } }).then(async (data) => {
            console.log(data);
            core.make('osjs/notification', {
              message: data.msg,
              onclick: () => console.log(data.msg)
            });
            let list = await proc.request('/task-list', { method: 'post' }); //任务列表
            taskWin.taskList.setRows(changeList2(list))
          })
        }
      ]
    })
  })


}

//1、创建初始app窗口（简历）
const createApplication = async (core, proc, win, $content) => {
  const mainBus = core.make('osjs/event-emitter');
  // var resumeList = await proc.request('/get-resume', { method: 'post' })
  //Hyperapp
  var mainApp = app(
    //state
    {
      orgView: listView.state({
        columns: [{
          label: '组织机构',
          style: {
            minWidth: '20em'
          }
        }],
        rows: [],
        // [
        //   { columns: ['常规招聘组'], },
        //   { columns: ['库房无忧-分支一'], },
        //   { columns: ['库房无忧--客服'], },
        //   { columns: ['库房无忧-困难部门'], }
        // ]
      }),
      resumeView: listView.state({
        columns: ['姓名', '职位名称/城市', '年龄', '工作年限', '学历', '毕业院校', '现职位', '简历来源', '投递日期'],
        // rows: changeList(resumeList),
        rows: [],
      })
    },
    //actions
    {
      getState: () => state => state,
      //组织机构
      orgView: listView.actions({
        select: ({ data }) => {
          mainBus.emit('refreshResume',win, data)
        }
      }),
      //简历
      resumeView: listView.actions({
      }),
      //刷新组织机构
      refreshOrg: () => { },
    },
    //简历视图（默认视图）view
    (state, actions) => {
      //简历视图
      const OrgView = listView.component(state.orgView, actions.orgView);
      const ResumeView = listView.component(state.resumeView, actions.resumeView);

      return h(Box, {}, [
        h(Menubar, {}, [
          h(MenubarItem, {
            onclick: ev => core.make('osjs/contextmenu', {
              position: ev.target,
              menu: [
                {
                  label: '添加账号',
                  items: [{
                    label: '智联',
                    onclick: ev => core.make('osjs/window', {
                      title: '登录账号', position: 'center', dimension: { width: 500, height: 500 }, attributes: { modal: true }
                    }).render(($content, win) => createLoginWin(core, proc, win, $content)).focus(),
                  },
                    // {
                    //   label: '前程',
                    //   onclick: ev => console.log('proc: ', proc),
                    // }
                  ],
                },
                {
                  label: '账号列表',
                  onclick: ev => core.make('osjs/window', {
                    title: '账号列表', position: 'center', dimension: { width: 500, height: 500 }, attributes: { modal: true }
                  }).render(($content, win) => accountListWin(core, proc, win, $content)).focus(),
                }
              ]
            })
          }, '账号'),
          h(MenubarItem, {
            onclick: ev => core.make('osjs/window', { title: '任务编辑', position: 'center', dimension: { width: 500, height: 500 }, }).render(($content, win) => createTaskWin(core, proc, win, $content)).focus(),
          }, '任务'),
          h(MenubarItem, {}, '简历'),
        ]),
        h(Panes, { style: { flex: '1 1' } }, [h(OrgView), h(ResumeView)]),
      ])
    }, $content);

  //监听刷新主窗口简历
  mainBus.on('refreshResume', async (win, data) => {
    proc.request('/org-resume', { method: 'post', body: { id: data } }).then((res) => {
      mainApp.resumeView.setRows(changeList(res));
    })
  })

  //监听刷新主窗口组织机构
  proc.on('refreshMain', async (data) => {
    //获取账号组织机构
    proc.request('/org-list', { method: 'post', body: { id: data } }).then(async (data) => {
      // console.log(data);
      var ar = [];
      data.orgInfo.forEach(el => {
        ar.push({ columns: Array(el.orgName), data: el.orgId });
      });
      // console.log(ar)
      mainApp.orgView.setRows(ar)
      win.focus();
    })
  })
}

const register = (core, args, options, metadata) => {
  const proc = core.make('osjs/application', { args, options, metadata });

  proc.createWindow({ //创建主窗口
    id: 'ZhaopinWindow',
    title: '招聘插件',
    icon: proc.resource(proc.metadata.icon),
    dimension: { width: 1000, height: 400 },
  })
    .on('destroy', () => proc.destroy())
    .render(($content, win) => createApplication(core, proc, win, $content)).maximize(); //渲染UI

  return proc;
};
// Creates the internal callback function when OS.js launches an application
osjs.register(applicationName, register);