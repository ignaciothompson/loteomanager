import { definePreset, updatePreset, updatePrimaryPalette, updateSurfacePalette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export type PrimaryScale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;

export const LANDING_COLOR_SCHEME = {
  light: {
    primary: {
      color: '{primary.500}',
      contrastColor: '#ffffff',
      hoverColor: '{primary.600}',
      activeColor: '{primary.700}',
    },
    highlight: {
      background: '{primary.50}',
      focusBackground: '{primary.100}',
      color: '{primary.700}',
      focusColor: '{primary.800}',
    },
  },
  dark: {
    primary: {
      color: '{primary.400}',
      contrastColor: '{surface.900}',
      hoverColor: '{primary.300}',
      activeColor: '{primary.200}',
    },
    highlight: {
      background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
      focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
      color: 'rgba(255,255,255,.87)',
      focusColor: 'rgba(255,255,255,.87)',
    },
  },
} as const;

export const TERRACOTA_SCALE: PrimaryScale = {
  50: '#FBF3EF',
  100: '#F6E4DA',
  200: '#EDC7B2',
  300: '#E2A587',
  400: '#D5825F',
  500: '#C2603D',
  600: '#A34B2E',
  700: '#833B25',
  800: '#64301F',
  900: '#4A2519',
  950: '#2E160F',
};

export const DEMO_PALETAS = [
  { nombre: 'Terracota', scale: TERRACOTA_SCALE },
  {
    nombre: 'Ocre',
    scale: {
      50: '#FBF6EA', 100: '#F5EAC9', 200: '#E9D18E', 300: '#DBB65C', 400: '#CC9C3A',
      500: '#B3822A', 600: '#916821', 700: '#70501A', 800: '#513A13', 900: '#3A290D', 950: '#221808',
    } satisfies PrimaryScale,
  },
  {
    nombre: 'Coral',
    scale: {
      50: '#FDF1EE', 100: '#FBDFD6', 200: '#F5BCA9', 300: '#ED9576', 400: '#E06F49',
      500: '#D0512D', 600: '#AC3F22', 700: '#87321B', 800: '#642514', 900: '#481B0F', 950: '#2C1009',
    } satisfies PrimaryScale,
  },
  {
    nombre: 'Vino',
    scale: {
      50: '#F7EEEC', 100: '#EED8D3', 200: '#DAB1A6', 300: '#C48576', 400: '#AA6151',
      500: '#8D4636', 600: '#71372A', 700: '#582B21', 800: '#401F18', 900: '#2E1610', 950: '#1B0D09',
    } satisfies PrimaryScale,
  },
] as const;

export const WARM_SURFACE_PALETTE = {
  0: '#FFFFFF',
  50: '#fff8f4',
  100: '#fff1e4',
  200: '#f4e6d7',
  300: '#eee0d1',
  400: '#dcc1b8',
  500: '#89726b',
  600: '#6B6155',
  700: '#56423c',
  800: '#3A342F',
  900: '#211a11',
  950: '#1A1714',
};

export function buildPrimaryPresetExt(scale: PrimaryScale) {
  return {
    semantic: {
      primary: scale,
      colorScheme: {
        light: {
          ...LANDING_COLOR_SCHEME.light,
          surface: WARM_SURFACE_PALETTE,
        },
        dark: {
          ...LANDING_COLOR_SCHEME.dark,
          surface: {
            0: '#2B2723',
            50: '#211a11',
            100: '#3A342F',
            200: '#4E4740',
            300: '#6B6155',
            400: '#8C8071',
            500: '#B3A38A',
            600: '#D4C7B3',
            700: '#E7DFD2',
            800: '#F3EEE6',
            900: '#FAF7F2',
            950: '#fff8f4',
          },
        },
      },
    },
  };
}

export const LandingWarmPreset = definePreset(Aura, buildPrimaryPresetExt(TERRACOTA_SCALE));

/** Runtime primary swap — updates CSS vars PrimeNG + tailwindcss-primeui. */
export function applyLandingPrimaryPalette(scale: PrimaryScale): void {
  updatePrimaryPalette(scale);
  updatePreset(buildPrimaryPresetExt(scale));
}

export function initLandingSurfacePalette(): void {
  updateSurfacePalette(WARM_SURFACE_PALETTE);
}
