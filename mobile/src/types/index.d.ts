export type InternalTheme = any;
export type ThemeProp<T> = T | undefined;
export type Theme = any;

declare module '@react-native-vector-icons/material-design-icons' {
  import type { ComponentType } from 'react';
  const MaterialDesignIcons: ComponentType<any>;
  export default MaterialDesignIcons;
}
