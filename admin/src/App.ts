// This file is part of HFS - Copyright 2021-2023, Massimo Melina <a@rejetto.com> - License https://www.gnu.org/licenses/gpl-3.0.txt

import { createElement as h, Fragment, useState } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import MainMenu, { getMenuLabel, mainMenu } from './MainMenu'
import { AppBar, Box, Drawer, IconButton, ThemeProvider, Toolbar, Typography } from '@mui/material'
import { anyDialogOpen, Dialogs } from './dialog'
import { useMyTheme } from './theme'
import { useBreakpoint} from './mui'
import { LoginRequired } from './LoginRequired'
import { Menu } from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import ConfigFilePage from './ConfigFilePage'
import { useSnapState } from './state'
import { useEventListener } from 'usehooks-ts'
import { AriaOnly, isMac, xlate } from './misc'
import { getLocale } from './locale'

function App() {
    return h(ThemeProvider, { theme: useMyTheme() },
        h(ApplyTheme, {},
            h(LocalizationProvider, { dateAdapter: AdapterDayjs, adapterLocale: getLocale() },
                h(LoginRequired, {},
                    h(HashRouter, {},
                        h(Dialogs, {
                            style: {
                                display: 'flex', flexDirection: 'column',
                                minHeight: '100%', flex: 1,
                                maxWidth: '100%',
                            }
                        }, h(Routed) ))) )))
}

function ApplyTheme(props:any) {
    return h(Box, {
        sx: { bgcolor: 'background.default', color: 'text.primary', flex: 1,
            transition: 'background-color .4s',
            maxWidth: '100%' /*avoid horizontal overflow (eg: customHtml with long line) */
        },
        ...props
    })
}

function Routed() {
    const loc = useLocation().pathname.slice(1)
    const current = mainMenu.find(x => x.path === loc)
    let { title } = useSnapState()
    title = current && (current.title || getMenuLabel(current)) || title
    const [open, setOpen] = useState(false)
    const large = useBreakpoint('lg')
    const xs = current?.noPaddingOnMobile ? 0 : 1
    const navigate = useNavigate()
    useEventListener('keydown', ({ key, ctrlKey, altKey }) => {
        if (anyDialogOpen()) return
        if (!(isMac ? ctrlKey : altKey)) return // alt doesn't work on Mac, but it is the only suitable key on Windows
        const idx = Number(xlate(key, { 0: 10 })) // key 0 is after 9 and works as 10
        if (!idx) return
        const path = mainMenu[idx - 1]?.path
        if (path === undefined) return
        navigate(path || '/')
    })
    return h(Fragment, {},
        h(AriaOnly, {}, h('h1', {}, "Admin-panel")),
        !large && h(StickyBar, { title, openMenu: () => setOpen(true) }),
        !large && h(Drawer, { anchor:'left', open, onClose(){ setOpen(false) } },
            h(MainMenu, {
                onSelect: () => setOpen(false),
                itemTitle,
            })),
        h(Box, { display: 'flex', flex: 1, }, // horizontal layout for menu-content
            large && h(MainMenu, { itemTitle, onSelect(){} }),
            h(Box, {
                component: 'main',
                sx: {
                    background: 'url(cup.svg) no-repeat right fixed',
                    backgroundSize: 'contain',
                    px: { xs, md: 2, lg: 3 },
                    pb: { xs, md: 2 },
                    boxSizing: 'border-box', // keep padding inside the viewport
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    overflowX: 'clip', // keep wide things in space
                }
            },
                title && large && h(Typography, { variant:'h2', mb:2 }, title),
                h(Routes, {},
                    mainMenu.map((it,idx) =>
                        h(Route, { key: idx, path: it.path, element: h(it.comp) })),
                    h(Route, { path: 'edit', element: h(ConfigFilePage) })
                )
            ),
        )
    )
}

function itemTitle(idx: number) {
    return idx < 10 ? `${isMac ? 'CTRL' : 'ALT'} + ${(idx+1) % 10}` : ''
}

function StickyBar({ title, openMenu }: { title?: string, openMenu: ()=>void }) {
    return h(AppBar, { position: 'sticky', sx: { mb: 2 } },
        h(Toolbar, {},
            h(IconButton, {
                size: 'large',
                edge: 'start',
                color: 'inherit',
                sx: { mr: 2 },
                'aria-label': "menu",
                onClick: openMenu
            }, h(Menu)),
            h(Box, { component: 'h2', m: 0 }, title),
        )
    )
}

export default App