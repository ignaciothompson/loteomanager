# LoteoManager
Monorepo para la gestión inmobiliaria.

## Scripts principales
- \`npm run dev:admin\` - Levanta el panel administrativo (CSR).
- \`npm run dev:landing\` - Levanta la landing page (SSR).
- \`npm run build:all\` - Compila ambas aplicaciones.
- \`npm run test:all\` - Ejecuta los tests de todos los proyectos.
- \`npm run lint:all\` - Ejecuta el linter en todos los proyectos.
- \`npm run pb:types\` - Regenera los tipos de TypeScript basados en la DB local de PocketBase.

## Arquitectura
- **apps/admin**: Panel administrativo con Angular y Sakai-NG.
- **apps/landing**: Landing page pública con Angular SSR.
- **libs/shared-***: Librerías compartidas (types, cliente PB, utils, UI).
- **docker/**: Configuración para despliegue en producción.

[Ver especificación técnica completa](../loteo-manager-spec-v2.md)
