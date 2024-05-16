//	*imports
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
//	server
import Koa from 'koa'
import { koaBody } from 'koa-body'
import render from 'koa-ejs'
import session from 'koa-generic-session'
import serve from 'koa-static'
//	import Router from 'koa-router'
//	misc
import chalk from 'chalk'
//	local services
import MyLife from './inc/js/mylife-agent-factory.mjs'
//	constants/variables
// @todo - parse environment variables in Globals and then have them available via as values
const app = new Koa()
const port = JSON.parse(process.env.PORT ?? '3000')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const _Maht = await MyLife // Mylife is the pre-instantiated exported version of organization with very unique properties. MyLife class can protect fields that others cannot, #factory as first refactor will request
const MemoryStore = new session.MemoryStore()
const mimeTypesToExtensions = {
	// Text Formats
	'text/plain': ['.txt', '.markdown', '.md', '.csv', '.log',], // Including Markdown (.md) as plain text
	'text/html': ['.html', '.htm'],
	'text/css': ['.css'],
	'text/javascript': ['.js'],
	'text/xml': ['.xml'],
	'application/json': ['.json'],
	'application/javascript': ['.js'],
	'application/xml': ['.xml'],
    // Image Formats
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/svg+xml': ['.svg'],
    'image/webp': ['.webp'],
    'image/tiff': ['.tiff', '.tif'],
    'image/bmp': ['.bmp'],
    'image/x-icon': ['.ico'],
    // Document Formats
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/rtf': ['.rtf'],
    'application/vnd.oasis.opendocument.text': ['.odt'],
    'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
    'application/vnd.oasis.opendocument.presentation': ['.odp'],
	// Audio Formats
	'audio/mpeg': ['.mp3'],
	'audio/vorbis': ['.ogg'], // Commonly .ogg can also be used for video
	'audio/x-wav': ['.wav'],
	'audio/webm': ['.weba'],
	'audio/aac': ['.aac'],
	'audio/flac': ['.flac'],
    // Video Formats
    'video/mp4': ['.mp4'],
    'video/x-msvideo': ['.avi'],
    'video/x-ms-wmv': ['.wmv'],
    'video/mpeg': ['.mpeg', '.mpg'],
    'video/webm': ['.webm'],
    'video/ogg': ['.ogv'],
    'video/x-flv': ['.flv'],
    'video/quicktime': ['.mov'],
    // Add more MIME categories, types, and extensions as needed
}
const serverRouter = await _Maht.router
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('MAHT')))
//	test harness region
//	koa-ejs
render(app, {
	root: path.join(__dirname, 'views'),
	layout: 'layout',
	viewExt: 'html',
	cache: false,
	debug: false,
})
// Set an interval to check for alerts every minute (60000 milliseconds)
setInterval(checkForLiveAlerts, JSON.parse(process.env.MYLIFE_SYSTEM_ALERT_CHECK_INTERVAL ?? '60000'))
//	app bootup
/* upload directory */
const uploadDir = path.join(__dirname, '.tmp')
if(!fs.existsSync(uploadDir)){
	fs.mkdirSync(uploadDir, { recursive: true })
}
//	app context (ctx) modification
app.context.MyLife = _Maht
app.context.Globals = _Maht.globals
app.context.menu = _Maht.menu
app.context.hostedMembers = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)
app.keys = [process.env.MYLIFE_SESSION_KEY ?? `mylife-session-failsafe|${_Maht.newGuid()}`]
// Enable Koa body w/ configuration
app.use(koaBody({
    multipart: true,
    formidable: {
		keepExtensions: true, // keep file extension
        maxFileSize: parseInt(process.env.MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN) || 10485760, // 10MB in bytes
		uploadDir: uploadDir,
		onFileBegin: (name, file) => {
			const { filepath,  mimetype, newFilename, originalFilename, size, } = file
			let extension = path.extname(originalFilename).toLowerCase()
			if(!extension)
				extension = mimeTypesToExtensions[mimetype]?.[0]
			/* validate mimetypes */
			const validFileType = mimeTypesToExtensions[mimetype]?.includes(extension)
			if(!validFileType)
				throw new Error('Invalid mime type')
			/* mutate newFilename && filepath */
			const { name: filename, } = path.parse(originalFilename)
			const safeName = filename.replace(/[^a-z0-9.]/gi, '_').replace(/\s/g, '-').toLowerCase() + extension
			/* @stub - create temp user sub-dir? */
			file.newFilename = safeName
			file.filepath = path.join(uploadDir, safeName)
			console.log(chalk.bgBlue('file-upload', chalk.yellowBright(file.filepath)))
        }
    },
}))
	.use(serve(path.join(__dirname, 'views', 'assets')))
	.use(
		session(	//	session initialization
			{
				key: 'mylife.sid',   // cookie session id
				maxAge: parseInt(process.env.MYLIFE_SESSION_TIMEOUT_MS) || 900000,     // session lifetime in milliseconds
				autoCommit: true,
				overwrite: true,
				httpOnly: false,
				signed: true,
				rolling: false,
				renew: false,
				store: MemoryStore,
			},
			app
		))
	.use(async (ctx,next) => { // GLOBAL ERROR `.catch()` to present in ctx format.
		try {
			await next()
		} catch (err) {
			ctx.status = err.statusCode || err.status || 500
			ctx.body = {
				message: err.message
			}
			console.error(err)
		}
	})
	.use(async (ctx,next) => {	//	SESSION: member login
		//	system context, koa: https://koajs.com/#request
		if(!ctx.session?.MemberSession){
			/* create generic session [references/leverages modular capabilities] */
			ctx.session.MemberSession = await ctx.MyLife.getMyLifeSession()	//	create default locked session upon first request; does not require init(), _cannot_ have in fact, as it is referencing a global modular set of utilities and properties in order to charge-back to system as opposed to member
			/* platform-required session-external variables */
			ctx.session.signup = false
			/* log */
			console.log(chalk.bgBlue('created-member-session'))
		}
		ctx.state.locked = ctx.session.MemberSession.locked
		ctx.state.MemberSession = ctx.session.MemberSession	//	lock-down session to state
		ctx.state.member = ctx.state.MemberSession?.member
			??	ctx.MyLife	//	point member to session member (logged in) or MAHT (not logged in)
		ctx.state.avatar = ctx.state.member.avatar
		ctx.state.contributions = ctx.state.avatar.contributions
		ctx.state.interfaceMode = ctx.state.avatar?.mode ?? 'standard'
		ctx.state.menu = ctx.MyLife.menu
		if(!await ctx.state.MemberSession.requestConsent(ctx))
			ctx.throw(404,'asset request rejected by consent')

		await next()
	})
	.use(async(ctx,next) => { // alert check
		await next()
	})
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreenBright('server available')+chalk.yellow(`\nlistening on port ${port}`))
	})
// Example of a periodic alert check function
function checkForLiveAlerts() {
    console.log("Checking for live alerts...")
	_Maht.getAlerts()	
}
