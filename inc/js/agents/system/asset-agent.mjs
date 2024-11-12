//	imports
import fs from 'fs'
import mime from 'mime-types'
//	module constants
const {
	MYLIFE_EMBEDDING_SERVER_BEARER_TOKEN: bearerToken,
	MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT,
	MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN,
	MYLIFE_SERVER_MBR_ID: mylifeMbrId,
} = process.env
const fileSizeLimit = parseInt(MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT) || 1048576
const fileSizeLimitAdmin = parseInt(MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN) || 10485760
class AssetAgent {
	#globals
	#llm
	#mbr_id
	#response
	#vectorstoreId
	#vectorstoreFileList=[] // openai vectorstore versions
	constructor(factory, llm){
		this.#mbr_id = factory.mbr_id
		this.#globals = factory.globals
		this.#llm = llm
	}
	/**
	 * Initializes the asset assistant by uploading the files to the vectorstore.
	 * @param {string} vectorstoreId - The vectorstore id to upload the files into, if already exists (avatar would know).
	 * @returns {Promise<AssetAgent>} - The initialized asset assistant instance.
	 */
	async init(vectorstoreId){
		if(!vectorstoreId?.length)
			throw new Error('No vectorstoreId parameter. Please initialize the asset assistant correctly.')
		this.#vectorstoreId = vectorstoreId
		await this.updateVectorstoreFileList() // sets `this.#vectorstoreFileList`
		return this
	}
	/**
	 * Updates the vectorstore file list.
	 * @returns {Promise<void>} - Resolves when the vectorstore file list is updated.
	 */
	async updateVectorstoreFileList(){
		let updateList = (await this.#llm.files(this.#vectorstoreId)).data
			.filter(file=>!(this.#vectorstoreFileList).find(vsFile=>vsFile.id===file.id))
		if(updateList?.length){
			updateList = await Promise.all(
				updateList.map(async file =>await this.#llm.file(file.id))
			)
			this.#vectorstoreFileList.push(...updateList)
		}
	}
	/**
	 * Uploads files to the vectorstore.
	 * @param {File[]} files - Array of uploaded files.
	 * @returns {Promise<void>} - Resolves when the files are uploaded.
	 */
	async upload(files){
		if(!Array.isArray(files) || !files.length)
			throw new Error('No files found in request.')
		const uploadFiles = []
		files
			.forEach(file=>{
				if(!this.#fileExists(file))
					uploadFiles.push(this.#extractFile(file))
			})
		if(uploadFiles.length){ // only upload new files
			const fileStreams = uploadFiles.map(file=>fs.createReadStream(file.filepath))
			const dataRecord = await this.#llm.upload(this.#vectorstoreId, fileStreams, this.mbr_id)
			const { response, success } = dataRecord
			if(success)
				await this.updateVectorstoreFileList()
		}
		files.forEach(file=>fs.unlinkSync(file.filepath)) /* delete .tmp files */
	}
	//	getters
	get files(){
		return this.vectorstoreFileList
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get response(){
		return this.#response
	}
	get vectorstoreFileList(){
		return this.#vectorstoreFileList
	}
	get vectorstoreId(){
		return this.#vectorstoreId
	}
	/* private methods */
	/**
	 * Takes an uploaded file object and extracts relevant file properties.
	 * @param {File} file - File object
	 * @returns {object} - Extracted file object.
	 */
	#extractFile(file){
		if(!file)
			throw new Error('No file found in request.')
		const { lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size } = file
		this.#validateFile(file)
		return {
			...{ lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size, localFilename: `${this.#globals.newGuid}.${mime.extension(mimetype)}` },
		}
	}
	/**
	 * Takes an array of uploaded file objects and extracts relevant file properties.
	 * @param {File[]} files - Array of file objects.
	 * @returns {File[]} - Array of extracted file objects.
	 */
	#extractFiles(files){
		if(!Array.isArray(files) || !files.length)
			throw new Error('No files found in request.')
		return files.map(file=>this.#extractFile(file))
	}
	#fileExists(file){
		return this.#vectorstoreFileList?.some(vsFile=>vsFile.id===file.id || file.originalFilename==vsFile?.filename || file.newFilename==vsFile?.filename)
	}
	/**
	 * Validates a file object, _throws error_ if file is invalid.
	 * @param {File} file - File object
	 * @returns {void}
	 */
	#validateFile(file){
		const allowedMimeTypes = [
			'application/json',
			'application/msword',
			'application/pdf',
			'application/rtf',
			'application/vnd.ms-powerpoint',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'text/csv',
			'text/html',
			'text/markdown',
			'text/plain',
		]
		const { size, mimetype } = file
		const maxFileSize = this.mbr_id === mylifeMbrId
			?	fileSizeLimitAdmin
			:	fileSizeLimit
		if((size ?? 0) > maxFileSize)
			throw new Error(`File size too large: ${ size }. Maximum file size is 1MB.`)
		if(!allowedMimeTypes.includes(mimetype))
			throw new Error(`Unsupported media type: ${ mimetype }. File type not allowed.`)
	}
}
/* exports */
export default AssetAgent