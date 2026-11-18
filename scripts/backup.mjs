import { DatabaseSync, backup } from 'node:sqlite';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
const dataDir = resolve(process.env.DATA_DIR || join(homedir(), '.local/share/fc-courfaivre'));
const database = new DatabaseSync(join(dataDir, 'fcc.sqlite'), { readOnly: true });
const destination = join(dataDir, `fcc-backup-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
await backup(database, destination); database.close(); console.log('Sauvegarde créée :', destination);
