export function testDB(sql){return {
 prepare(q){let v=[];const run=()=>({meta:{changes:sql.prepare(q).run(...v).changes}});return {bind(...values){v=values;return this},async first(){return sql.prepare(q).get(...v)},async all(){return {results:sql.prepare(q).all(...v)}},async run(){return run()},execute:run};},
 async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}
};}
