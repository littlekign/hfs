// This file is part of HFS - Copyright 2021-2022, Massimo Melina <a@rejetto.com> - License https://www.gnu.org/licenses/gpl-3.0.txt

import { createElement as h, FC, Fragment, isValidElement, ReactElement, ReactNode, useEffect, useState } from 'react'
import {
    Box,
    FormControl,
    FormControlLabel, FormHelperText,
    FormLabel,
    Grid,
    MenuItem, Radio,
    RadioGroup,
    Switch,
    TextField
} from '@mui/material'
import { Dict, useStateMounted } from './misc'
import { Save } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import _ from 'lodash'

interface FieldDescriptor { k:string, comp?: any, label?: string | ReactElement, [extraProp:string]:any }

// it seems necessary to cast (Multi)SelectField sometimes
export type Field<T> = FC<FieldProps<T>>

interface FormProps {
    fields: (FieldDescriptor | ReactElement | null | undefined | false)[]
    defaults?: (f:FieldDescriptor) => Dict | void
    values: Dict
    set: (v: any, field: FieldDescriptor) => void
    save?: Dict
    stickyBar?: boolean
    addToBar?: ReactNode[]
    barSx?: Dict
    [rest:string]: any
}
export function Form({ fields, values, set, defaults, save, stickyBar, addToBar=[], barSx, formRef, ...rest }: FormProps) {
    const [loading, setLoading] = useStateMounted(false)
    const onClick = save?.onClick
    if (onClick)
        save.onClick = async function () {
            setLoading(true)
            try { return await onClick(this, arguments) }
            finally { setLoading(false) }
        }

    const [pendingSubmit, setPendingSubmit] = useStateMounted(false)
    useEffect(() => {
        if (!pendingSubmit) return
        setTimeout(save?.onClick)
        setPendingSubmit(false)
    }, [pendingSubmit]) //eslint-disable-line

    const bar = save && h(Box, {
            display: 'flex',
            alignItems: 'center',
            sx: Object.assign({},
                stickyBar && { width: 'fit-content', zIndex: 2, backgroundColor: 'background.paper', position: 'sticky', top: 0 },
                barSx)
        },
        h(LoadingButton, {
            variant: 'contained',
            startIcon: h(Save),
            children: "Save",
            loading,
            ...save,
        }),
        ...addToBar,
    )

    return h('form', {
        ref: formRef,
        onSubmit(ev) {
            ev.preventDefault()
        },
        onKeyDown(ev) {
            if (!save?.disabled && (ev.ctrlKey || ev.metaKey) && ev.key === 'Enter')
                setPendingSubmit(true) // we need to let outer component perform its state changes
        }
    },
        h(Box, {
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            ...rest
        },
            stickyBar && bar,
            h(Grid, { container:true, rowSpacing:3, columnSpacing:1 },
                fields.map((row, idx) => {
                    if (!row)
                        return null
                    if (isValidElement(row))
                        return h(Grid, { key: idx, item: true, xs: 12 }, row)
                    let field = row
                    const { k, onChange } = field
                    if (k) {
                        field = {
                            value: values?.[k],
                            ...field,
                            onChange(v:any) {
                                if (onChange)
                                    v = onChange(v)
                                set(v, field)
                            },
                        }
                        if (field.label === undefined)
                            field.label = _.capitalize(k.replaceAll('_', ' '))
                        _.defaults(field, defaults?.(field))
                    }
                    const { xs=12, sm, md, lg, xl, comp=StringField, ...rest } = field
                    return h(Grid, { key: k, item: true, xs, sm, md, lg, xl },
                        isValidElement(comp) ? comp : h(comp, rest) )
                })
            ),
            !stickyBar && bar,
        )
    )
}

export interface FieldProps<T> {
    label?: string | ReactElement
    value?: T
    onChange: (v: T, more: { was?: T, event: any, [rest: string]: any }) => void
    toField?: (v: any) => T,
    fromField?: (v: T) => any
    [rest: string]: any
}

export function StringField({ value, onChange, fromField=_.identity, toField=_.identity, ...props }: FieldProps<string>) {
    if (fromField === JSON.parse)
        fromField = v => v ? JSON.parse(v) : undefined
    const [state, setState] = useState(() => toField(value) ?? '')
    const [err, setErr] = useState('')
    if (err) {
        props.error = true
        props.helperText = h(Fragment, {}, err, props.helperText && h('br'), props.helperText ) // keep existing helperText, if any
    }

    useEffect(() => {
        setState(() => toField(value) ?? '')
        setErr('')
    }, [value, toField])
    return h(TextField, {
        fullWidth: true,
        InputLabelProps: state || props.placeholder ? { shrink: true } : undefined,
        ...props,
        value: state,
        onChange(event) {
            setState(event.target.value)
        },
        onKeyDown(ev) {
            if (ev.key === 'Enter')
                go(ev)
        },
        onBlur: go
    })

    function go(event: any) {
        let newV
        try { // catch parsing exceptions
            newV = fromField(state)
        }
        catch (e) {
            return setErr(String(e))
        }
        if (newV !== value)
            onChange(newV, {
                was: value,
                event,
                cancel() {
                    setState(value ?? '')
                }
            })
    }
}

export function DisplayField({ value, empty='-', ...props }: any) {
    if (!props.toField && empty !== undefined && value !== 0 && !value)
        value = empty
    return h(StringField, {  ...props, value, disabled: true })
}

type SelectOptions<T> = { [label:string]:T } | SelectOption<T>[]
type SelectOption<T> = SelectPair<T> | (T extends string | number ? T : never)
interface SelectPair<T> { label: string, value:T }

export function SelectField<T>(props: FieldProps<T> & { options:SelectOptions<T> }) {
    const { value, onChange, options, ...rest } = props
    return h(TextField, { // using TextField because Select is not displaying label correctly
        ...commonSelectProps(props),
        ...rest,
        onChange(event) {
            try {
                let newVal: any = event.target.value
                newVal = JSON.parse(newVal) as T
                onChange(newVal, { was: value, event })
            }
            catch {}
        }
    })
}

export function MultiSelectField<T>(props: FieldProps<T[]> & { options:SelectOptions<T> }) {
    const { value, options, ...rest } = props
    return h(TextField, {
        ...commonSelectProps({ ...props, value:undefined }),
        ...rest,
        SelectProps: { multiple: true },
        value: !Array.isArray(value) ? [] : value.map(x => JSON.stringify(x)),
        onChange(event) {
            try {
                let v: any = event.target.value
                v = Array.isArray(v) ? v.map(x => JSON.parse(x)) : []
                props.onChange(v as T[], { was: value, event })
            }
            catch {}
        }
    })
}

function commonSelectProps<T>(props: { value?: T, disabled?: boolean, options:SelectOptions<T> }) {
    const { options, disabled } = props
    const normalizedOptions = !Array.isArray(options) ? Object.entries(options).map(([label,value]) => ({ value, label }))
        : options.map(o => typeof o === 'string' || typeof o === 'number' ? { value: o, label: String(o) } : o as SelectPair<T>)
    const jsonValue = JSON.stringify(props.value)
    const currentOption = normalizedOptions.find(x => JSON.stringify(x.value) === jsonValue)
    return {
        select: true,
        fullWidth: true,
        // avoid warning for invalid option. This can easily happen for a split-second when you keep value in a useState (or other async way) and calculate options with a useMemo (or other sync way) causing a temporary misalignment.
        value: currentOption ? jsonValue : '',
        disabled: !normalizedOptions?.length || disabled,
        children: normalizedOptions.map((o, i) => h(MenuItem, {
            key: i,
            value: JSON.stringify(o?.value),
            children: o?.label
        }))
    }
}

export function NumberField({ value, onChange, ...props }: FieldProps<number | null>) {
    // @ts-ignore
    return h(StringField, {
        type: 'number',
        value: typeof value === 'number' ? String(value) : '',
        onChange(v, { was, ...rest }) {
            onChange(v ? Number(v) : null, { ...rest, was:was ? Number(was) : null })
        },
        ...props,
    })
}

export function BoolField({ label='', value, onChange, helperText, fromField=_.identity, toField=_.identity, ...props }: FieldProps<boolean>) {
    const setter = () => toField(value) ?? false
    const [state, setState] = useState(setter)
    useEffect(() => setState(setter),
        [value]) //eslint-disable-line
    const control = h(Switch, {
        checked: state,
        ...props,
        onChange(event) {
            onChange(fromField(event.target.checked), { event, was: value })
        }
    })
    return h(Box, { ml: 1, mt: 1 },
        h(FormControlLabel, { label, control, labelPlacement: 'end' }),
        helperText && h(FormHelperText,{},helperText)
    )
}

export function RadioField<T>({ label, options, value, onChange }: FieldProps<T> & { options:SelectPair<T>[] }) {
    return h(FormControl, {},
        label && h(FormLabel, {}, label),
        h(RadioGroup, {
            row: true,
            name: '',
            value: JSON.stringify(value),
            onChange(event, v){
                onChange(JSON.parse(v), { was: value, event })
            }
        },
            options.map(({ value, label }, idx) =>
                h(FormControlLabel, { key: idx, value, control: h(Radio), label }) )
        )
    )
}
