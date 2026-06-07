/**
 * @type {import('electron-builder').Configuration}
 */
export default {
  appId: 'com.vida.organism',
  productName: 'Vida',
  electronVersion: '33.4.11',
  directories: {
    output: 'dist',
    buildResources: 'resources'
  },
  files: [
    '!**/.vscode/*',
    '!src/**/*',
    '!scripts/**/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!electron-builder.config.js',
    '!resources/**/*',
    '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!{tsconfig.json,tsconfig.node.json}'
  ],
  extraResources: [
    {
      from: 'resources',
      to: 'resources'
    }
  ],
  extraMetadata: {
    main: './out/main/index.js'
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Graphics',
    icon: 'resources/icon.png'
  },
  mac: {
    target: ['dmg'],
    category: 'public.app-category.graphics-design',
    icon: 'resources/icon.png'
  },
  win: {
    target: ['nsis'],
    icon: 'resources/icon.png'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  }
}
