import { h } from 'hyperapp';

export const Account = (props = {}, children = []) => {
    //多步操作
    const steps = [
        (state, actions) =>
            h(Box, { margin: false }, [
                h(TextField, {
                    placeholder: '用户名',
                    value: state.user.name,
                    oninput: (ev, name) => actions.user.set(name)
                }),
                h(TextField, {
                    placeholder: '密码',
                    value: state.user.password,
                })
            ]),
        (state, actions) =>
            h(Box, {}, [
                h(TextField, {
                    placeholder: '手机号',
                    value: state.user.phone,
                }),
                h(TextField, {
                    placeholder: '验证码',
                    value: state.user.code,
                })
            ]),
        (state, actions) =>
            h(Box, {}, [
                h(Toolbar, {}, [
                    h(Button, {}, '常规招聘组'),
                    h(Button, {}, '库房无忧-分支一'),
                    h(Button, {}, '库房无忧-客服'),
                ]),
                h(Toolbar, {}, [
                    h(Button, {}, '库房无忧-困难部门')
                ])
            ]),
    ]
}