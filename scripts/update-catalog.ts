import { FetchClient } from '@gracious.tech/fetch-client'
import { writeFile } from 'node:fs/promises'
const collection = await new FetchClient({
	usage: { limitless: true, derivatives: true },
}).fetch_collection()
const catalog = collection.bibles
	.get_resources({
		language: 'eng',
		exclude_incomplete: true,
		exclude_obsolete: true,
	})
	.filter(
		(t) =>
			collection.bibles.get_books(t.id).length === 66 && t.direction === 'ltr',
	)
	.map((t) => ({
		id: t.id,
		abbreviation: t.name_abbrev.toUpperCase(),
		name: t.name,
		attribution: t.attribution,
		attributionUrl: t.attribution_url,
		licenses: t.licenses,
		books: collection.bibles.get_books(t.id).map((b) => b.id),
	}))
	.filter((t) => /^[A-Z0-9-]+$/.test(t.abbreviation))
	.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
await writeFile(
	'src/data/catalog.json',
	JSON.stringify(catalog, null, 2) + '\n',
)
console.log(catalog.map((t) => t.abbreviation).join(', '))
