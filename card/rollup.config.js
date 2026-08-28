import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/schedule-manager-card.ts',
  output: {
    file: '../custom_components/schedule_manager/www/schedule-manager-card.js',
    format: 'es',
  },
  plugins: [
    resolve(),
    typescript(),
  ],
};