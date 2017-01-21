const opening = function() {
	const d = document
	const w = window
	var FPS = 1000
	var TRAIL_PLAN = [ 'u', 'r', 'd', 'b', 'r', 'c' ]
	var pointCopy = function(src, dst) {
		dst.x = src.x
		dst.y = src.y
		dst.z = src.z

		return dst
	}
	var Trail = function(pos, t, plan_i) {
		this.pos = {
			x: 0,
			y: 0,
			z: 0
		}
		this.start = {
			x: 0,
			y: 0,
			z: 0
		}
		this.goal = {
			x: 0,
			y: 0,
			z: 0
		}
		this.start_time
		this.take_time
		this.vertexes = []
		pointCopy(pos, this.pos)
		pointCopy(pos, this.start)
		pointCopy(pos, this.goal)
		this.plan_i = plan_i % TRAIL_PLAN.length || 0
		this.sz = pos.z
		this.setNextGoal(t)
	}
	Trail.prototype.setNextGoal = function(t) {
		pointCopy(this.goal, this.start)
		this.plan_i = (this.plan_i + 1) % TRAIL_PLAN.length
		switch (TRAIL_PLAN[this.plan_i]) {
			case 'r':
				this.goal.x += Math.random() * 50 + 50
				break
			case 'u':
				this.goal.y -= Math.random() * 250 + 100
				break
			case 'd':
				this.goal.y = 0
				break
			case 'b':
				this.goal.z += Number(Math.random())
				break
			case 'c':
				this.goal.z = this.sz
				break
			default:
				break
		}
		this.start_time = t
		this.take_time = 100 + Math.random() * 100
		this.vertexes.push(pointCopy(this.start, {
			x: 0,
			y: 0,
			z: 0
		}))
		if (this.vertexes.length > 100) {
			this.vertexes.splice(0, this.vertexes.length - 100)
		}
	}
	Trail.prototype.update = function(t) {
		quadIn(
			t - this.start_time,
			this.start,
			this.goal,
			this.take_time,
			this.pos
		)
		if (t - this.start_time > this.take_time) {
			this.setNextGoal(this.start_time + this.take_time)
			this.update(t)
		}
	}
	Trail.prototype.draw = function(ctx, camera) {
		var i
		var ps = {
			x: 0,
			y: 0
		}
		ctx.beginPath()
		if (perspective(this.vertexes[0], camera, ps)) {
			ctx.moveTo(ps.x, ps.y)
		}
		var x0 = ps.x
		for (i = 1; i < this.vertexes.length; i++) {
			if (perspective(this.vertexes[i], camera, ps)) {
				ctx.strokeStyle = 'rgba(36,198,224,' + 2 / (this.vertexes[i].z - camera.z) + ')'
				ctx.lineTo(ps.x, ps.y)
				ctx.stroke()
				ctx.beginPath()
				ctx.moveTo(ps.x, ps.y)
			}
		}
		if (perspective(this.pos, camera, ps)) {
			ctx.strokeStyle = 'rgba(36,198,224,' + 2 / (this.pos.z - camera.z) + ')'
			ctx.lineTo(ps.x, ps.y)
			ctx.stroke()
		}
	}
	var quadIn = function(t, b, c, d, dst) {
		t /= d
		dst.x = (c.x - b.x) * t * t + b.x
		dst.y = (c.y - b.y) * t * t + b.y
		dst.z = (c.z - b.z) * t * t + b.z
	}
	var perspective = function(point, camera, dst) {
		var dz = point.z - camera.z
		if (dz > 0) {
			dst.x = (point.x - camera.x) / dz
			dst.y = (point.y - camera.y) / dz

			return true
		}

		return false
	}
	var updateScene = function(ctx) {
		var i
		var time_now = new Date().getTime()
		var time_d = time_now - time_pre
		for (i = 0; i < trails.length; i++) {
			trails[i].update(time_now)
		}
		camera.x += (trails[0].pos.x - camera.x - 50) * 0.0002 * time_d
		camera.y += (trails[0].pos.y - camera.y - 300) * 0.00002 * time_d
		time_pre = time_now
	}
	var drawScene = function(ctx) {
		var i
		ctx.clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
		for (i = 0; i < trails.length; i++) {
			trails[i].draw(ctx, camera)
		}
	}
	var canvas = d.getElementById('canvas')
	var ctx = canvas.getContext('2d')
	var trails = []
	var i
	var time_now = new Date().getTime()
	var time_pre = time_now
	for (i = 0; i < 8; i++) {
		trails.push(new Trail({
			x: Math.random() * 100 - 50,
			y: Math.random() * 100 - 50,
			z: i
		}, time_now, i))
	}
	var camera = {
		x: 0,
		y: 0,
		z: -2
	}
	canvas.width = w.innerWidth
	canvas.height = w.innerHeight
	ctx.translate(canvas.width / 2, canvas.height / 2)
	setInterval(function() {
		updateScene()
		drawScene(ctx)
	}, 1000 / FPS)
}

export default opening
