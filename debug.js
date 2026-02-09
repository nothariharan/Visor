try { console.log('Testing dependency-cruiser...'); require('dependency-cruiser'); console.log('dependency-cruiser OK'); } catch (e) { console.error('dependency-cruiser FAIL:', e.message); }
try { console.log('Testing elkjs...'); require('elkjs'); console.log('elkjs OK'); } catch (e) { console.error('elkjs FAIL:', e.message); }
try { console.log('Testing simple-git...'); require('simple-git'); console.log('simple-git OK'); } catch (e) { console.error('simple-git FAIL:', e.message); }
try { console.log('Testing chokidar...'); require('chokidar'); console.log('chokidar OK'); } catch (e) { console.error('chokidar FAIL:', e.message); }
