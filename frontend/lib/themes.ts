// The color themes. A theme is a block of token values in app/globals.css,
// :root[data-theme="<id>"] { --background: ...; ... }, plus one entry here.
// colorScheme drives the "dark" class (shadcn's dark: styles), native controls and the toasts.
// Picking a theme (cookie / preference) comes with the preferences feature; until then
// everyone gets the default.
export const themes = [{ id: "hydra-dark", colorScheme: "dark" }] as const

export type Theme = (typeof themes)[number]

export const defaultTheme: Theme = themes[0]
