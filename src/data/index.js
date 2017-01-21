import Datastore from 'nedb'
const db = new Datastore({
	filename: './.retroconfig',
	autoload: true
})

export default db
