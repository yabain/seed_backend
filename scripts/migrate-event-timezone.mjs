/**
 * Migration : ajoute le fuseau horaire par défaut aux événements existants.
 *
 * Avant l'introduction du champ `timezone`, les événements ont été créés sans
 * fuseau. Cette migration affecte le défaut `Africa/Douala` (GMT+1) à tout
 * événement n'ayant pas déjà un `timezone` renseigné.
 *
 * Exécution (depuis la racine du backend) :
 *   node scripts/migrate-event-timezone.mjs
 *
 * Aucune suppression : uniquement un ajout de champ par défaut.
 */
import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { parse } from 'dotenv';

const envPath = new URL('../.env', import.meta.url).pathname;
const env = parse(readFileSync(envPath, 'utf8'));

const MONGODB_URI = env.MONGODB_URI || '';
const MONGODB_DB = env.MONGODB_DB || 'seed';
const DEFAULT_TIMEZONE = 'Africa/Douala';

if (!MONGODB_URI) {
  console.error('MONGODB_URI manquante dans .env');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

async function main() {
  await client.connect();
  const db = client.db(MONGODB_DB);

  // Cible : événements sans `timezone` (champ absent OU vide).
  const filter = {
    $or: [{ timezone: { $exists: false } }, { timezone: '' }],
  };

  const before = await db.collection('events').countDocuments({});
  const toFix = await db.collection('events').countDocuments(filter);

  if (toFix === 0) {
    console.log(
      `Aucun événement à migrer (${before} événements, 0 sans fuseau).`,
    );
    await client.close();
    return;
  }

  const result = await db.collection('events').updateMany(filter, {
    $set: { timezone: DEFAULT_TIMEZONE },
  });

  const after = await db.collection('events').countDocuments(filter);
  console.log('=== Migration timezone événements ===');
  console.log(`Total événements   : ${before}`);
  console.log(`Modifiés           : ${result.modifiedCount}`);
  console.log(`Reste sans fuseau  : ${after}`);
  console.log(`Fuseau appliqué    : ${DEFAULT_TIMEZONE} (GMT+1)`);

  await client.close();
  console.log('Migration terminée.');
}

main().catch((err) => {
  console.error('Erreur de migration :', err.message);
  process.exit(1);
});