.PHONY: run build

run:
	./run_build_and_main.sh

build:
	cd web/frontend && npm run build
