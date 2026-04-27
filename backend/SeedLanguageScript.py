# Seed the language table with some common programming languages

from app import app; 
from database import db; 
from models import Language; 
ctx=app.app_context(); 
ctx.push(); 
existing={l.language for l in Language.query.all()}; 
add=[]; 
add.append(Language(language='python', docker_image='python:3.13-alpine', run_cmd='python')) if 'python' not in existing else None; add.append(Language(language='javascript', docker_image='node:22-alpine', run_cmd='node')) if 'javascript' not in existing else None; [db.session.add(x) for x in add]; db.session.commit(); print('seeded', [x.language for x in add]); print('all', [(l.lang_id,l.language) for l in Language.query.order_by(Language.lang_id).all()]); ctx.pop()