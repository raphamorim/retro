import Datastore from 'nedb'

const db = new Datastore({
	filename: '~/.retroconfig',
	autoload: true
})

export function findOrCreate(data) {
	return new Promise((resolve, reject) => {
		db.find({}, (err, results) => {
			if (!results.length) {
				db.insert(data, (savedConfig) => {
					resolve(savedConfig)
				})
			}

			resolve(results[0])
		})
	})
}

export default db
