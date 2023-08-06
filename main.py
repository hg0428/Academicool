import json
import pathlib
from replit import db
import quart
from quart import redirect, render_template, request, g, send_from_directory, flash, url_for
from werkzeug.utils import secure_filename
import uuid
import os
import asyncio
import aiohttp
# Multiple choicde didn't work.
app = quart.Quart(__name__)
#app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["DEBUG"] = False
#app.jinja_env.cache = {}
course_data_path = "static/raw-course-data"
course_files = pathlib.Path(course_data_path)
courses = {}
for course_file in course_files.iterdir():
  course = json.load(open(course_file))
  if isinstance(course['concepts'], dict):
    concepts = []
    for lesson in course['concepts']:
      oldToNew = {}
      i=0
      for c in course['concepts'][lesson]:
        oldToNew[str(i)] = str(len(concepts))
        concepts.append(c)
        i+=1
      for p in course['problems'][lesson]:
        req_concepts = []
        for c in course['problems'][lesson][p['id']]['required-concepts']:
          req_concepts.append(oldToNew[c])
        course['problems'][lesson][p['id']]['required-concepts'] = req_concepts
    course['concepts'] = concepts
  if 'data' not in course:
    course['data'] = course['problems']
  if 'problems' in course:
    del course['problems']
  if 'sections' not in course: # Hold potential collection items here then just collect by id?
    course['sections'] = []
  if len(course['concepts'])>0 and not course['concepts'][0].get('id'):
    for i in range(len(course['concepts'])):
      course['concepts'][i]['id'] = i
  json.dump(course, open(course_file, 'w'))
  #Migrate course structure to the latest format.
  courses[course['id']] = course
print(f'We have {len(db.keys())} users!')

#TODO: rate limits
#https://pypi.org/project/quart-rate-limiter/#:~:text=Quart%2DRate%2DLimiter%20is%20an,Fields%20for%20HTTP%20RFC%20draft.

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER = 'static/files'
app.config['ALLOWED_EXTENSIONS'] = ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'svg', 'webp', 'mp3', 'm4a', 'txt', 'md', 'mp4', 'mov', 'webm'
}
ACCOUNT_UPLOAD_LIMIT = 10_000_000

def average(l):
  return sum(l)/len(l)
def allowed_file(filename):
  return '.' in filename and filename.rsplit(
      '.', 1)[1].lower() in ALLOWED_EXTENSIONS


async def fetch_user_data(username):
  body = {
      'query':
      "query getUserInfo ($username: String!) { userByUsername(username: $username) {bio, isVerified, fullName, image}}",
      'variables': {
          'username': username
      }
  }
  headers = {
      "X-Requested-With": "replit",
      "Origin": "https://replit.com",
      "Accept": "application/json",
      "Referrer": "https://replit.com/jdog787",
      "Content-Type": "application/json",
      "Connection": "keep-alive",
      "Host": "replit.com",
      "x-requested-with": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0"
  }
  url = "https://replit.com/graphql"
  async with aiohttp.ClientSession(headers=headers) as session:
    async with session.post(url, json=body) as response:
      data = await response.json()
      return data['data']['userByUsername']
  #Send a post request to https://replit.com/graphql with the following headers:
  #Get the json from the response, and the data we want is the responce.data.userByUsername


@app.before_request
async def before_req():
  g.user = None
  if request.endpoint == 'static':
    return
  g.loggedin = False
  g.user_id = request.headers.get('X-Replit-User-Id')
  if g.user_id:
    g.loggedin = True
    g.user_name = request.headers.get('X-Replit-User-Name')
    if g.user_id not in db:
      data = await fetch_user_data(g.user_name)
      db[g.user_id] = {
          "id": g.user_id,
          "user-name": g.user_name,
          "bio": data['bio'],
          "pic": data['image'] or "/static/img/default-profile.png",
          "courses": {},
          "most-recently-opened-course": None,
          "editable-courses": [],
          "version": 3,
          "email-verified": data['isVerified'],
          "files": [],
          "uploaded_bytes": 0
      }
    elif db[g.user_id].get("version", -1) < 3:
      data = await fetch_user_data(g.user_name)
      db[g.user_id]['bio'] = data['bio']
      db[g.user_id]['pic'] = data['image'] or "/static/img/default-profile.png"
      db[g.user_id]['email-verified'] = data['isVerified']
      if not db[g.user_id]['files']:
        db[g.user_id]['files'] = []
        db[g.user_id]['uploaded_bytes'] = 0
      else:
        db[g.user_id]['uploaded_bytes'] = 0
        for f in db[g.user_id]['files']:
          db[g.user_id]['uploaded_bytes'] += os.stat(
              os.path.join(UPLOAD_FOLDER, f)).st_size
      db[g.user_id]['version'] = 3
    if not db[g.user_id].get("uploaded_bytes"):
      db[g.user_id]['uploaded_bytes'] = 0
    g.user = json.loads(db.get_raw(g.user_id))


@app.route('/')
async def homepage():
  return await render_template('homepage.html', loggedin=g.loggedin)


@app.route('/account/reset/confirmed')
async def account_reset():
  pass  #TODO


@app.route('/course')
async def course_page():
  course_id = request.args.get('course_id')
  if g.user and course_id not in g.user['courses']:
    course_id = None
  if course_id and course_id in courses:
    course_id = request.args.get('course_id')
    if g.user:
      db[g.user_id]['most-recently-opened-course'] = course_id
  elif g.user:
    course_id = g.user['most-recently-opened-course']
    if not course_id and len(g.user['courses']) > 0:
      course_id = list(g.user['courses'].keys())[0]
    elif not course_id:
      return quart.redirect('/course/new')
  else:
    course_id = None
  return await render_template('course-page.html',
                               loggedin=g.loggedin,
                               course=courses.get(course_id),
                               user=g.user,
                               len=len,
                               list=list)


@app.route('/course/new')
async def new_course_page():
  #TODO: only send some courses, not all
  message = 'Find a course for you!'
  if request.args.get('new') or (g.user and len(g.user['courses']) == 0):
    message = "Pick a course to get started."
  return await render_template('new-course.html',
                               courses=courses,
                               loggedin=g.loggedin,
                               message=message,
                               user=g.user,
                               users={
                                   id: {
                                       'id': id,
                                       'user-name': db[id]['user-name'],
                                       'pic': db[id]['pic']
                                   }
                                   for id in db.keys()
                               })


@app.route('/course/edit/<course_id>')
async def edit_course(course_id):
  if not g.user:
    return f'Not loggedin. <a href="/begin?redirect=/course/edit/{course_id}">Click here to login</a>'

  if course_id not in courses:
    return '404, cannot find course. <a href="/course/new">Click here to return to course browser.</a>'
  if g.user and g.user['id'] in courses[course_id]['editors']:
    return await render_template(
        'edit-course.html',
        course=courses[course_id],
        loggedin=g.loggedin,
        user=g.user,
        users={
            id: {
                'id': id,
                'user-name': db[id]['user-name'],
                'pic': db[id]['pic']
            }
            for id in db.keys()
        }) 
  else:
    return 'No permision<a href="/course/new">Click here to return to course browser.</a>'


@app.route('/course/preview/<course_id>')
async def course_preview(course_id):
  if course_id not in courses:
    return '404, cannot find course. <a href="/course/new">Click here to return to course browser.</a>'
  return await render_template('course-preview.html',
                               course=courses[course_id],
                               loggedin=g.loggedin,
                               user=g.user, creator=db[courses[course_id]['creator']])


@app.route('/course/add/<course_id>')
async def add_course(course_id):
  if course_id not in courses:
    return 404, '404, cannot find course. <a href="/course/new">Click here to return to course browser.</a>'
  if g.user:
    db[g.user_id]['courses'][course_id] = {
        "completed-lessons": {},
        'course-title': courses[course_id]['titles']['course'],
        'collections': {} #How should the system be programmed??
    }
    db[g.user_id]['most-recently-opened-course'] = course_id
  return redirect(f'/course?course_id={course_id}')


@app.route('/course/remove/<course_id>')
async def remove_course(course_id):
  if not course_id in courses:
    return 404, "Ha! You can't delete a course that doesn't exist!"
  del db[g.user_id]['courses'][course_id]
  if db[g.user_id]['most-recently-opened-course'] == course_id:
    db[g.user_id]['most-recently-opened-course'] = None
  return redirect(f'/course/preview/{course_id}')


@app.route('/course/delete/<course_id>')
async def delete_course(course_id):
  if not g.user:
    return f'Must be logged in!! <a href="/begin?redirect=/course/edit/{course_id}">Click Here to go to login</a>'
  if course_id not in courses:
    return '404, cannot find course. <a href="/course/new">Click here to return to course browser.</a>'
  if g.user and g.user['id'] in courses[course_id]['editors']:
    os.remove(course_data_path + '/' + course_id + '.json')
    del courses[course_id]
    return redirect('/course')
  else:
    return 'No permision<a href="/course/new">Click here to return to course browser.</a>'


@app.route('/course/create')
async def create_course():
  if not g.user:
    return 'Must be logged in!! <a href="/begin?redirect=/course/create">Click Here to go to login</a>'
  id = str(uuid.uuid4())
  num = 0
  name = 'Untitled Course'
  for i in g.user['editable-courses']:
    if courses.get(i) and courses[i]['titles']['course'] == name:
      if num == 0:
        name += '(1)'
      else:
        name = name.replace(f'({num})', f'({num+1})')
      num += 1
    elif not courses.get(i):
      g.user['editable-courses'].remove(i)

  courses[id] = {
      "id": id,
      "editors": [g.user['id']],
      "creator": g.user['id'],
      "description": "My course.",
      "titles": {
          "course": name,
          'learn': 'Learn',
          'concepts': 'Concepts',
          'problems': 'Problems'
      },
      "concepts": [],
      "problems": {},
      "lessons": {}
  }
  open(course_data_path + "/" + id + '.json',
       'w').write(json.dumps(courses[id]))
  db[g.user['id']]['editable-courses'].append(id)
  return redirect(f'/course/edit/{id}')


@app.route('/begin')
async def begin():
  if g.loggedin:
    redir = '/course'
    if request.args.get("redirect"):
      redir = request.args.get("redirect")
    return quart.redirect(redir)
  return await render_template('begin.html')


valid_problem_types = ['multiple-choice', 'checkbox', 'text', 'number', 'data', 'collection']


@app.route('/api/save-course', methods=['GET', 'POST'])
async def save_course():
  if not g.user:
    return {
        "error":
        True,
        "message":
        'Must be logged in!! <a href="/begin">Click Here to go to login</a>'
    }
  data = await request.get_json(force=True)
  if courses[data['id']]['creator'] != g.user['id'] and data[
      'id'] not in g.user['editable-courses']:
    return {"error": True, "message": 'Permission Denied'}
  #Allow removing editors?

  #Check data
  if g.user['id'] != data['creator']:
    data['creator'] = g.user['id']
  #   for lesson in data['concepts']:
  #     if type(lesson) != str:
  #       del data['concepts'][lesson]
  #     elif type(data['concepts'][lesson]) != list:
  #       data['concepts'][lesson] = []
  #     if lesson not in data['data']:
  #       data['data'][lesson] = []
  
      #TODO: check and make sure all concepts are valid.
  if type(data.get('data')) != dict:
    data['data'] = {}
  else:
    for lesson in data['data']:
      if type(lesson) != str:
        del data['data'][lesson]
      elif type(data['data'][lesson]) != list:
        data['data'][lesson] = []
      for problem in data['data'][lesson]:
        if problem.get('type') not in valid_problem_types:
          if type(problem.get('options')) == list:
            problem['type'] = 'multiple-choice'
          else:
            problem['type'] = 'text'
        if type(problem.get('answers')) != list:
          problem['answers'] = []
        if type(problem.get('data')) != list:
          problem['data'] = []
        #TODO: Handle if there is no id.
  if type(data.get('titles')) != dict:
    data['titles'] = {
        'course': '',
        # "learn": '',
        "concepts": "",
        "problems": ""
    }
  else:
    for item in ['course', 'learn', 'concepts', 'problems']:
      if item not in data['titles']:
        data['titles'][item] = ""
  if type(data.get('description')) != str:
    data['description'] = ""
  if not all(isinstance(item, str) for item in data.get('editors', [0])):
    data['editors'] = [data.get('editors', [])]
  if g.user['id'] not in data["editors"]:
    data["editors"].append(g.user['id'])
  for u_id in data['editors']:
    if data['id'] not in db[u_id]['editable-courses']:
      if data['id'].startswith('@'):
        for user_id_1 in db:
          if db[user_id_1]['user-name'] == u_id:
            u_id = db[user_id_1]['id']
      db[u_id]['editable-courses'].append(data['id'])
  courses[data['id']] = data
  open(course_data_path + "/" + data['id'] + '.json',
       'w').write(json.dumps(courses[data['id']]))
  return {"error": False, "data": data}


@app.route('/api/update-user-courses', methods=['GET', 'POST'])
async def save_user_scores():
  if not g.user:
    return {
        "error":
        True,
        "message":
        'Must be logged in!! <a href="/begin">Click Here to go to login</a>'
    }
  data = await request.get_json(force=True)
  for id in data:
    db[g.user['id']]['courses'][id]['completed-lessons'] = data[id][
        'completed-lessons']
  return {"error": False, "data": g.user['courses']}


@app.route('/account', methods=['GET', 'POST'])
async def account():
  if not g.user:
    g.user = {
      'pic': '',
      'user-name': 'User',
      'files': ['2004382New_Recording_5-0.m4a'],
      'uploaded_bytes': 5000,
      "id": 0
    }
  #   return redirect('/')
  if request.method == 'POST':
    # check if the post request has the file part
    if 'file' not in await request.files:
      return await render_template('account.html',
                                   message="No file selected.",
                                   user=g.user,
                                   data_limit=ACCOUNT_UPLOAD_LIMIT)
    file = (await request.files)['file']
    # If the user does not select a file, the browser submits an
    # empty file without a filename.
    if file.filename == '':
      return await render_template('account.html',
                                   message="No file selected.",
                                   user=g.user,
                                   data_limit=ACCOUNT_UPLOAD_LIMIT)
    if file and allowed_file(file.filename):
      ext = '.'+secure_filename(file.filename).split('.')[-1]
      id = str(uuid.uuid4())
      newname = secure_filename(g.user['id'] + '-' + id + ext)
      while newname in os.listdir(app.config['UPLOAD_FOLDER']):
        newname = secure_filename(g.user['id'] + '-' + id + ext)
        id = str(uuid.uuid4())
      file_size = len(file.read())
      if db[g.user['id']]['uploaded_bytes'] + file_size > ACCOUNT_UPLOAD_LIMIT:
        return await render_template('account.html',
                                   message="Upload limit reached.",
                                   user=g.user,
                                   data_limit=ACCOUNT_UPLOAD_LIMIT)
      db[g.user['id']]['uploaded_bytes'] += file_size
      db[g.user['id']]['files'].append(newname)
      file.seek(0) #To reset it after reading
      await file.save(os.path.join(app.config['UPLOAD_FOLDER'], newname))
      g.user = json.loads(db.get_raw(g.user_id))
      return await render_template('account.html',
                                   message='File uploaded.',
                                   user=g.user,
                                   data_limit=ACCOUNT_UPLOAD_LIMIT)
  else:
    return await render_template('account.html',
                                 message='',
                                 user=g.user,
                                 data_limit=ACCOUNT_UPLOAD_LIMIT)

@app.route('/api/delete-file', methods=["POST"])
async def delete_file():
  if not g.user:
    return {
        "error":
        True,
        "message":
        'Must be logged in!! <a href="/begin">Click Here to go to login</a>'
    }
  data = await request.get_json(force=True)
  if data['file'] not in g.user['files']:
    return {
      "error": True,
      "message": "Access Denied"
    }
  size = os.stat(
              os.path.join(UPLOAD_FOLDER, data['file'])).st_size
  try:
    os.remove('static/files/'+data['file'])
  except OSError:
    return {
      'error': True,
      "message": 'Action cause an error'
    }
  db[g.user_id]['files'].remove(data['file'])
  db[g.user_id]['uploaded_bytes'] -= size;
  return {
    'error': False,
    "message": "Success!",
    "uploaded_bytes": db[g.user_id]['uploaded_bytes'],
    "data_limit": ACCOUNT_UPLOAD_LIMIT
  }
@app.route('/favicon.ico')
async def fav():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'favicon.ico')


@app.route('/apple-touch-icon.png')
async def ati():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'apple-touch-icon.png')


@app.route('/android-chrome-192x192.png')
async def ac192():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'android-chrom-192x192.png')


@app.route('/android-chrome-512x512.png')
async def ac512():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'android-chrom-512x512.png')


@app.route('/favicon-16x16.png')
async def fav16():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'favicon-16x16. png')


@app.route('/favicon-32x32.png')
async def fav32():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'favicon-32x32.png')


@app.route('/site.webmanifest')
async def webmanifest():
  return await send_from_directory(os.path.join('static', 'favicon'),
                                   'site.webmanifest')


@app.after_request
async def add_headers(resp):
  resp.headers["X-Frame-Options"] = "DENY"
  resp.headers["Expires"] = "4000"
  resp.headers["Cache-Control"] = "max-age=4000"
  resp.headers["Pragma"] = "no-cache"
  resp.headers["X-Content-Type-Options"] = "nosniff"
  resp.headers["Content-Security-Policy"] = "base-uri 'self'"
  return resp


app.run("0.0.0.0", 8080, debug=False, use_reloader=False)
