import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) { console.log('Missing env vars'); process.exit(1); }

const supabase = createClient(url, key);

const { count: overrideCount, error: e1 } = await supabase
  .from('profile_overrides')
  .select('*', { count: 'exact', head: true });
console.log('profile_overrides total rows:', overrideCount, e1?.message || '');

const samplePhones = ['2012206875', '2014682688', '2016907413'];
const { data: sample, error: e2 } = await supabase
  .from('profile_overrides')
  .select('phone_number, email')
  .in('phone_number', samplePhones);
console.log('sample phone matches:', JSON.stringify(sample), e2?.message || '');

const { count: reportCount, error: e3 } = await supabase
  .from('reports')
  .select('*', { count: 'exact', head: true });
console.log('reports total rows:', reportCount, e3?.message || '');
