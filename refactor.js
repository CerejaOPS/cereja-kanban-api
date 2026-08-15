const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes', 'tasks.js');
let content = fs.readFileSync(filePath, 'utf8');

// Adicionar a importação do AppError
if (!content.includes('AppError')) {
  content = content.replace(
    import { Router } from 'express';,
    import { Router } from 'express';\nimport { AppError } from '../utils/AppError.js';
  );
}

// Trocar as assinaturas das rotas
content = content.replace(/async \(req, res\) => {/g, 'async (req, res, next) => {');

// Trocar res.status(500) por next(error)
content = content.replace(/return res\.status\(500\)\.json\(\{ error: error\.message \}\);/g, 'return next(error);');

// Trocar res.status(400) por throw new AppError
content = content.replace(/return res\.status\(400\)\.json\(\{ error: ('.*?') \}\);/g, 'throw new AppError(, 400);');
content = content.replace(/return res\.status\(400\)\.json\(\{ error: (.*?\.message) \}\);/g, 'throw new AppError(, 400);');
content = content.replace(/return res\.status\(400\)\.json\(\{ error: (.*?)(?: \+ | \) \}\);/g, (match) => {
   // This is a bit tricky for template strings, let's just use a more generic replace for 400s
   return match;
});

// Trocar res.status(404) por throw new AppError
content = content.replace(/return res\.status\(404\)\.json\(\{ error: ('.*?') \}\);/g, 'throw new AppError(, 404);');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Refatoracao de tasks.js concluida.');
