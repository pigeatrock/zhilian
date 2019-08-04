import { h } from 'hyperapp';
import { SelectField } from '@osjs/gui';
import { FieldContainer } from './FieldContainer';

export const SelectFieldContainer = props => (state, actions) =>
    h(FieldContainer, props, h(SelectField, {
        choices: props.choices,
        value: state.form[props.name],
        name: props.name,
        onchange: props.onchange,
    }));