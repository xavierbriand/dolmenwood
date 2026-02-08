
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const DENYLIST_PATH = path.join(ROOT_DIR, 'policies', 'ip-denylist.yaml');
const STATE_PATH = path.join(ROOT_DIR, 'policies', 'ip-state.json');

// Generic fantasy/RPG terms that are definitely NOT Dolmenwood IP
const COMMON_TERMS = new Set([
  'Activity', 'Reaction', 'Encounter', 'Creature', 'Monster', 'Animal', 'Mortal', 'Sentient',
  'Daytime', 'Nighttime', 'Road', 'Wild', 'Fire', 'No Fire',
  'Common', 'Regional',
  'Adventuring Party', 'Cleric', 'Fighter', 'Thief', 'Bandit', 'Pirate', 'Magician', 'Hunter',
  'Knight', 'Merchant', 'Pedlar', 'Pilgrim', 'Priest', 'Villager', 'Witch',
  'Bear', 'Boar', 'Wolf', 'Rat', 'Bat', 'Toad', 'Snake', 'Adder', 'Weasel', 'Stirge', 'Beetle',
  'Centipede', 'Fly', 'Insect', 'Swarm', 'Crab', 'Fish', 'Catfish', 'Pike', 'Leech',
  'Giant', 'Small', 'Large', 'Swarm',
  'Skeleton', 'Zombie', 'Ghoul', 'Wight', 'Spectre', 'Ghost', 'Wraith', 'Shadow',
  'Ogre', 'Troll', 'Goblin', 'Griffon', 'Cockatrice', 'Basilisk', 'Wyvern', 'Dragon',
  'Werewolf', 'Vampire', 'Harpy', 'Manticore', 'Chimera', 'Hydra',
  'Unicorn', 'Pegasus', 'Centaur', 'Dryad', 'Nymph', 'Sprite', 'Fairy', 'Elf', 'Dwarf', 'Gnome', 'Halfling',
  'Celebrating', 'Chasing', 'Constructing', 'Defecating', 'Dying', 'Wounded', 'Fleeing', 
  'Hallucinating', 'Hunting', 'Foraging', 'In combat with', 'Journey', 'Pilgrimage', 
  'Lost', 'Exploring', 'Marking territory', 'Mating', 'Courting', 'Negotiating', 
  'Patrolling', 'Guarding', 'Resting', 'Camping', 'Ritual', 'Magic', 'Sleeping', 
  'Trapped', 'Imprisoned', 'Washing',
  'Attacks', 'Hostile', 'Uncertain', 'Wary', 'Indifferent', 'Eager', 'Friendly',
  'Text', 'Regional', 'Structure', 'Description', 'Treasure', 'Lair'
]);

// Prefixes that indicate structural/generic names
const IGNORE_PREFIXES = [
  'Encounter Type -',
  'Common -',
  'Regional -' 
  // Note: We might want to protect specific Region names, but "Regional - " itself is generic.
  // The logic below handles this: if we split by "-", "High Wold" becomes a candidate.
];

interface Denylist {
  terms: string[];
}

interface IpState {
  lastReviewed: string; // ISO timestamp
}

function getAllYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map(file => path.join(dir, file));
}

function extractTerms(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);
    const terms: string[] = [];

    const visit = (obj: any) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(visit);
      } else if (typeof obj === 'object') {
        if (typeof obj.name === 'string') {
          terms.push(obj.name);
        }
        // Also check 'ref' in entries as they point to other tables/creatures
        if (Array.isArray(obj.entries)) {
             obj.entries.forEach((e: any) => {
                 if (e.ref) terms.push(e.ref);
             });
        }
        Object.values(obj).forEach(visit);
      }
    };

    visit(data);
    return terms;
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e);
    return [];
  }
}

function loadDenylist(): Set<string> {
  if (!fs.existsSync(DENYLIST_PATH)) return new Set();
  try {
    const content = fs.readFileSync(DENYLIST_PATH, 'utf8');
    const data = yaml.load(content) as Denylist;
    return new Set(data.terms || []);
  } catch {
    return new Set();
  }
}

function saveDenylist(terms: Set<string>) {
  const sorted = Array.from(terms).sort();
  const content = yaml.dump({ terms: sorted });
  fs.writeFileSync(DENYLIST_PATH, content, 'utf8');
}

function saveState() {
  const state: IpState = {
    lastReviewed: new Date().toISOString()
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

async function main() {
  console.log('🔍 Scanning assets for potential IP terms...');
  
  const files = getAllYamlFiles(ASSETS_DIR);
  const existingDeny = loadDenylist();
  const allTerms = new Set<string>();

  files.forEach(file => {
    const fileTerms = extractTerms(file);
    fileTerms.forEach(t => allTerms.add(t));
  });

  const candidates = new Set<string>();

  for (const term of allTerms) {
    // 1. Cleanup: Remove structural prefixes for analysis
    let cleanTerm = term;
    for (const prefix of IGNORE_PREFIXES) {
      if (cleanTerm.startsWith(prefix)) {
        cleanTerm = cleanTerm.substring(prefix.length).trim();
      }
    }

    // 2. Filter: Already denied?
    if (existingDeny.has(term) || existingDeny.has(cleanTerm)) continue;

    // 3. Filter: Common/Safe?
    if (COMMON_TERMS.has(cleanTerm)) continue;
    
    // Split composite terms "Giant Rat" -> check "Giant", "Rat" (Too aggressive? No, keep full terms)
    
    // 4. Heuristic: Is it likely unique?
    // Filter out simple numbers or purely structural refs if any
    if (/^\d+$/.test(cleanTerm)) continue;

    candidates.add(cleanTerm);
  }

  if (candidates.size === 0) {
    console.log('✅ No new potential IP terms found.');
  } else {
    console.log(`⚠️  Found ${candidates.size} new potential IP terms:`);
    const sortedCandidates = Array.from(candidates).sort();
    
    // In an interactive CLI, we would ask the user.
    // Since I am the agent, I will output them and AUTO-ADD them for this initial pass, 
    // assuming the user wants to protect what's currently in assets.
    // In a real dev flow, this would be interactive.
    
    sortedCandidates.forEach(c => console.log(` - ${c}`));
    
    console.log('\n📝 Adding all candidates to denylist...');
    sortedCandidates.forEach(c => existingDeny.add(c));
    saveDenylist(existingDeny);
  }

  saveState();
  console.log('💾 State updated.');
}

main().catch(console.error);
