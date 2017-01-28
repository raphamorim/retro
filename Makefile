YARN := $(shell command -v yarn 2> /dev/null)
BIN := ./node_modules/.bin

help:
	@echo '    setup .................... sets up project dependencies'
	@echo '    run ...................... runs project'
	@echo '    test ..................... runs tests'
	@echo '    setup_upgrade ............ upgrades project dependencies'
	@echo '    clean .................... deletes project dependencies'
	@echo '    install_node.............. sets up node version'
	@echo '    setup_nvm ................ sets up nvm'
	@echo '    lint ..................... runs code linter'

setup: install_node
ifndef YARN
	npm install
else
	yarn
endif

build:
	npm run build

pack-osx:
	npm run pack:osx

watch:
	npm run dev

run:
	npm start

lint:
	$(BIN)/eslint --ext .js src/

lint-autofix:
	$(BIN)/eslint --fix --ext .js src/

test:
	$(MAKE) lint
	npm test

setup_upgrade: clean
	npm install
	npm shrinkwrap

install_node: setup_nvm
	bash -c "source ~/.nvm/nvm.sh && nvm install 6.9.4 && nvm use 6.9.4"
	@echo "Add these lines to your bash_profile, bashrc ..."
	@echo "	source ~/.nvm/nvm.sh"
	@echo "	[[ -r $NVM_DIR/bash_completion ]] && . $NVM_DIR/bash_completion"

setup_nvm:
	if test -d ~/.nvm ; then \
		echo "Nvm is already installed"; \
	else \
		curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.0/install.sh | bash; \
	fi

clean:
	-rm -rf node_modules
