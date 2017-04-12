const editor = (state = null, action) => {
  switch (action.type) {
    case 'OPEN_FILE':
      return 'reading'
    case 'SAVE_FILE':
      return 'saving'
    default:
      return state
  }
}

export default editor
