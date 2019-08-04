import { h } from 'hyperapp';
import { Box, BoxContainer } from '@osjs/gui';

export const FieldContainer = (props, children) =>
    h(Box, { margin: false }, [
        h(BoxContainer, {}, props.label),
        ...children
    ]);