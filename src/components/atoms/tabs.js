import React, { Component } from 'React'

export default class Tabs extends Component {
	// TODO: unfocus and focus (class)

	constructor(props) {
		super()
		this.state = { items: props.items || [] }
	}

	mountTabItems() {
		const { items } = this.state
		if (!items)
			return null

		let tabItems = []

		for (let i = 0; i < items.length; i++) {
			tabItems.push(
				<div className="tabs-item active">items[i]</div>
			)
		}

		return tabItems
	}

	render() {
		const tabItems = this.mountTabItems()

		return (
			<section role="tabs" className="tabs">
				{ tabItems }
			</section>
		)
	}
}
