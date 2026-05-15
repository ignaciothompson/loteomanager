#!/usr/bin/env bash
# Regenera tipos TypeScript desde el schema de PocketBase.
# Requiere: npx pocketbase-typegen y pb_data/data.db existente (descargar de prod o usar local).

echo "=> Generando tipos de PocketBase..."
npx pocketbase-typegen --db ./docker/pb_data/data.db --out ./shared-types/src/lib/pocketbase-types.ts
echo "=> ¡Tipos generados exitosamente!"
