import { tamaguiPlugin } from '@tamagui/vite-plugin'
import type { UserConfig } from 'vite'
import { removeReactNativeWebAnimatedPlugin, vxs } from 'vxs/vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import tsconfigPaths from 'vite-tsconfig-paths'

const resolve = (path: string) => {
  const resolved = import.meta.resolve?.(path)
  if (!resolved) {
    throw new Error(`Not found: ${path}, maybe on wrong node version`)
  }
  return resolved.replace('file:/', '')
}

export default {
  resolve: {
    alias: [
      {
        find: '@docsearch/react',
        replacement: resolve('@docsearch/react'),
      },
      {
        find: /^react-native$/,
        replacement: '/Users/n8/tamagui/code/ui/react-native-web/dist/esm/index.mjs',
      },
      {
        find: /^react-native\/(.*)$/,
        replacement: '/Users/n8/tamagui/code/ui/react-native-web/dist/esm/index.mjs',
      },
      {
        find: /^react-native-web$/,
        replacement: '/Users/n8/tamagui/code/ui/react-native-web/dist/esm/index.mjs',
      },
      {
        find: /^react-native-web\/(.*)$/,
        replacement: '/Users/n8/tamagui/code/ui/react-native-web/dist/esm/index.mjs',
      },
    ],

    dedupe: [
      'react',
      'react-dom',
      '@tamagui/core',
      '@tamagui/web',
      '@tamagui/animations-moti',
      '@tamagui/toast',
      'tamagui',
      '@tamagui/use-presence',
      'react-native-reanimated',
      '@tamagui/react-native-web',
    ],
  },

  ssr: {
    noExternal: true,
    external: ['@tamagui/mdx'],
  },

  define: {
    'process.env.TAMAGUI_DISABLE_NO_THEME_WARNING': '"1"',
  },

  plugins: [
    vxs({
      setupFile: './config/setupTamagui.ts',

      server: {
        compression: true,
      },
    }),

    tsconfigPaths(),

    ViteImageOptimizer(),

    // removeReactNativeWebAnimatedPlugin(),

    tamaguiPlugin({
      optimize: true,
      components: ['tamagui'],
      config: './config/tamagui.config.ts',
      outputCSS: './app/tamagui.css',
    }),
  ],
} satisfies UserConfig
