import { h } from 'hyperapp';
import { TextField } from '@osjs/gui';
import { FieldContainer } from './FieldContainer';

export const TextFieldContainer = props => (state, actions) =>
    h(FieldContainer, props, h(TextField, {
        value: state.form[props.name],
        name: props.name,
        oninput: props.oninput,
    }));