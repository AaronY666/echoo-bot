/**
 * Electron 主进程引导文件
 * 用于加载 TypeScript 主进程文件
 */

// 注册 ts-node
require('ts-node').register({
  transpileOnly: true,
  project: './tsconfig.electron.json',
});

// 加载 TypeScript 主进程
require('./main.ts');
