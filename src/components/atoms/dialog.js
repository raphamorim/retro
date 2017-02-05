import React from 'React'

export default function Dialog(props) {
    return (
        <section role="dialog" className="modal">
            <input type="text" className="modal-search" id="modal-search" placeholder="Search for packages...." />
            <div className="modal-items"></div>
        </section>
    )
}
