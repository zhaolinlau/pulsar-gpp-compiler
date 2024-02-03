/* global atom */
"use strict";

const child_process = require("child_process");
const fs = require("fs").promises; // Use promisified version of fs for async/await
const path = require("path");
const os = require("os");
const { CompositeDisposable } = require("atom");

module.exports = {
	activate() {
		// Initialize a composite disposable to manage subscriptions
		this.subscriptions = new CompositeDisposable();

		// Register commands for the text editor
		this.subscriptions.add(
			atom.commands.add("atom-text-editor", {
				"pulsar-gpp-compiler:compile": () => {
					// When the "Compile" command is triggered, call the compileFile function
					this.compileFile(this.getFileType());
				},

				"pulsar-gpp-compiler:gdb": () => {
					// When the "Compile with Debug" command is triggered, call the compileFile function with gdb flag
					this.compileFile(this.getFileType(), true);
				},
			})
		);

		// Register commands for the tree view
		this.subscriptions.add(
			atom.commands.add(".tree-view .file", {
				"pulsar-gpp-compiler:tree-compile": (e) => {
					// When the "Compile" command is triggered from the tree view, call the treeCompile function without gdb
					this.treeCompile(e, false);
				},

				"pulsar-gpp-compiler:tree-gdb": (e) => {
					// When the "Compile with Debug" command is triggered from the tree view, call the treeCompile function with gdb flag
					this.treeCompile(e, true);
				},
			})
		);
	},

	// Configuration settings for the package
	config: {
		// Add compiling error file
		addCompilingErr: {
			default: true,
			description:
				"Add a file named `compiling_error.txt` if compiling goes wrong",
			title: "Add `compiling_error.txt`",
			type: "boolean",
		},

		// Split pane direction for 'compiling_error.txt'
		splitDirection: {
			default: "down",
			description:
				"Choose the split direction when opening 'compiling_error.txt'.",
			title: "Split Direction",
			type: "string",
			enum: ["down", "right", "none"],
		},

		// Debug mode
		debug: {
			default: false,
			description: "Logs function calls in the console.",
			title: "Debug Mode",
			type: "boolean",
		},

		// C compiler command line options
		cCompilerOptions: {
			default: "",
			description: "C compiler command line options",
			title: "C Compiler Options",
			type: "string",
		},

		// C++ compiler command line options
		cppCompilerOptions: {
			default: "",
			description: "C++ compiler command line options",
			title: "C++ Compiler Options",
			type: "string",
		},

		// Run program after compilation
		runAfterCompile: {
			default: true,
			description: "Run the program after compiling is done",
			title: "Run After Compile",
			type: "boolean",
		},

		// Show compile warnings
		showWarnings: {
			default: true,
			description: "Show compile warnings.",
			title: "Show Warnings",
			type: "boolean",
		},

		// C compiler executable
		cCompiler: {
			default: "gcc",
			description: "The path or name of the C compiler executable to use",
			title: "C Compiler",
			type: "string",
		},

		// C++ compiler executable
		cppCompiler: {
			default: "g++",
			description: "The path or name of the C++ compiler executable to use",
			title: "C++ Compiler",
			type: "string",
		},

		// Compile to a temporary directory
		compileToTmpDirectory: {
			default: true,
			description:
				"Compile to a temporary directory instead of the specified directory",
			title: "Compile to Temporary Directory",
			type: "boolean",
		},

		// Close the error tab and switch to the current compiling file on successful compilation
		closeErrorTabOnSuccess: {
			default: true,
			description:
				"Close the error tab and switch to the current compiling file on successful compilation",
			title: "Close Error Tab on Success",
			type: "boolean",
		},

		// Show error notifications
		showErrorNotifications: {
			default: false,
			description: "Show error notifications for compilation errors.",
			title: "Show Error Notifications",
			type: "boolean",
		},
	},

	deactivate() {
		// Dispose of all subscriptions when the package is deactivated
		this.subscriptions.dispose();
	},
	async compileFile(fileType, gdb) {
		const file = this.getFilePath();

		if (file) {
			const filePath = file.path;
			const info = path.parse(filePath);

			try {
				// Attempt to compile the file and handle any potential errors
				await this.compile(
					this.getCommand(fileType),
					info,
					this.getArgs(
						[filePath],
						this.getCompiledPath(info.dir, info.name),
						fileType,
						gdb ? ["-g"] : null
					),
					gdb
				);
			} catch (error) {
				// Handle and display errors as Atom notifications
				atom.notifications.addError(
					`<strong>Error:</strong><br/>${error.message}`
				);
			}
		} else {
			atom.notifications.addError(
				"<strong>File not found.</strong><br/>Save before compiling."
			);
		}
	},

	async treeCompile(e, gdb) {
		const names = Array.from(
			document.querySelectorAll(".tree-view .file.selected > .name")
		);

		const files = names
			.filter((name) => name instanceof HTMLElement)
			.map((element) => element.getAttribute("data-path"));

		let element = e.target;

		if (element.classList.contains("file")) {
			element = element.firstChild;
		}

		const info = path.parse(element.getAttribute("data-path"));
		const fileType = this.getFileType(info.ext);

		try {
			// Attempt to compile the selected files from the tree view and handle any potential errors
			await this.compile(
				this.getCommand(fileType),
				info,
				this.getArgs(
					files,
					this.getCompiledPath(info.dir, info.name),
					fileType,
					gdb ? ["-g"] : null
				),
				gdb
			);
		} catch (error) {
			// Handle and display errors as Atom notifications
			atom.notifications.addError(
				`<strong>Error:</strong><br/>${error.message}`
			);
		}
	},

	async compile(command, info, args, gdb) {
		const editor = atom.workspace.getActiveTextEditor();
		const activePane = atom.workspace.getActivePane(); // Get the active pane

		if (editor) {
			// If there's an active text editor, save its contents
			await editor.save();
		}

		return new Promise((resolve) => {
			const child = child_process.spawn(command, args, {
				cwd: info.dir,
			});

			let stderr = "";

			child.stderr.on("data", (data) => {
				stderr += data;
				this.debug("stderr", data.toString());
			});

			child.on("close", async (code) => {
				this.debug("exit code", code);

				if (code) {
					// If the compilation exits with a non-zero status code, handle the error
					if (atom.config.get("pulsar-gpp-compiler.showErrorNotifications")) {
						atom.notifications.addError(stderr.replace(/\n/g, "<br/>"));
					}

					if (atom.config.get("pulsar-gpp-compiler.addCompilingErr")) {
						try {
							// Attempt to write the compilation error to a file
							await fs.writeFile(
								path.join(info.dir, "compiling_error.txt"),
								stderr
							);
							this.debug("compiling_error.txt has been written successfully.");

							// Open the compiling_error.txt file in a new split pane
							const errorFile = await atom.workspace.open(
								path.join(info.dir, "compiling_error.txt"),
								{ split: atom.config.get("pulsar-gpp-compiler.splitDirection") }
							);

							// Make the 'compiling_error.txt' file read-only
							if (errorFile) {
								errorFile.setSoftTabs(false);
								errorFile.setSoftWrapped(true);
								errorFile.setReadOnly(true);
							}

							// Display the compiling_error.txt pane
							atom.workspace.paneContainerForItem(errorFile).activate();

							// Focus back on the active pane (the C/C++ file)
							activePane.activate();
						} catch (err) {
							console.error("Error writing compiling_error.txt:", err);
						}
					}
				} else {
					if (stderr && atom.config.get("pulsar-gpp-compiler.showWarnings")) {
						// If there are compilation warnings and the setting to show warnings is enabled, display them
						atom.notifications.addWarning(stderr.replace(/\n/g, "<br/>"));
					}

					if (atom.config.get("pulsar-gpp-compiler.runAfterCompile")) {
						// If the user wants to run the program after compilation, invoke the runProgram function
						this.runProgram(info, gdb);
					} else {
						// Display a success notification when the compilation is successful
						atom.notifications.addSuccess("Compilation Successful");
					}

					// Check the new configuration setting for the behavior
					const closeErrorTabOnSuccess = atom.config.get(
						"pulsar-gpp-compiler.closeErrorTabOnSuccess"
					);

					if (closeErrorTabOnSuccess) {
						try {
							// Check if the `compiling_error.txt` file exists and close it if it's open
							atom.workspace.getTextEditors().forEach((textEditor) => {
								if (
									textEditor.getPath() ===
									path.join(info.dir, "compiling_error.txt")
								) {
									textEditor.destroy();
								}
							});
						} catch (err) {
							this.debug("Error closing compiling_error.txt:", err);
						}
					}

					// Always attempt to delete the `compiling_error.txt` file
					try {
						// Check if the `compiling_error.txt` file exists and delete it if it does
						await fs.access(path.join(info.dir, "compiling_error.txt"));
						await fs.unlink(path.join(info.dir, "compiling_error.txt"));
						this.debug("compiling_error.txt has been deleted successfully.");
					} catch (err) {
						this.debug("Error deleting compiling_error.txt:", err);
					}

					// Switch to the current compiling C/C++ file as the active tab/window
					const fileToOpen = path.join(info.dir, info.base);
					atom.workspace.open(fileToOpen);

					// Focus back on the active pane (the C/C++ file)
					activePane.activate();

					resolve();
				}
			});
		});
	},

	async runProgram(info, gdb) {
		// Get the path to the compiled file
		const file = this.getCompiledPath(info.dir, info.name);

		// Check the current platform
		if (process.platform === "linux") {
			// Get the configured Linux terminal
			const terminal = atom.config.get("pulsar-gpp-compiler.linuxTerminal");
			let terminalCommand = null;
			let args = null;

			// Determine the appropriate terminal and arguments based on the configured terminal
			switch (terminal) {
				case "GNOME Terminal":
					terminalCommand = "gnome-terminal";
					args = ["--command"];
					break;
				case "Konsole":
					terminalCommand = "konsole";
					args = [...(gdb ? [] : ["--hold"]), "-e"];
					break;
				case "xfce4-terminal":
					terminalCommand = "xfce4-terminal";
					args = [...(gdb ? [] : ["--hold"]), "--command"];
					break;
				case "pantheon-terminal":
					terminalCommand = "pantheon-terminal";
					args = ["-e"];
					break;
				case "URxvt":
					terminalCommand = "urxvt";
					args = [...(gdb ? [] : ["-hold"]), "-e"];
					break;
				case "MATE Terminal":
					terminalCommand = "mate-terminal";
					args = ["--command"];
					break;
				default:
					terminalCommand = "xterm";
					args = [...(gdb ? [] : ["-hold"]), "-e"];
			}

			// Log the command and arguments for debugging purposes
			this.debug("command", terminalCommand, args, gdb, file);

			// Spawn the selected terminal with appropriate arguments
			child_process.spawn(
				terminalCommand,
				[...args, ...(gdb ? ["gdb"] : []), file],
				{
					cwd: info.dir,
				}
			);
		} else if (process.platform === "win32") {
			// On Windows, open the compiled file with optional gdb debugger
			const command = `start "${info.name}" cmd /C "${
				gdb ? "gdb" : ""
			} ${file} ${gdb ? "" : "& echo. & pause"}`;

			// Log the command for debugging purposes
			this.debug("command", command);

			// Execute the command in a new Windows Command Prompt window
			child_process.exec(command, {
				cwd: info.dir,
			});
		} else if (process.platform === "darwin") {
			// On macOS, open the compiled file
			child_process.spawn("open", [file], {
				cwd: info.dir,
			});
		}
	},

	debug(...args) {
		// Conditionally log messages to the console based on the debug setting
		if (atom.config.get("pulsar-gpp-compiler.debug")) {
			console.info(...args);
		}
	},

	getFileType(ext) {
		// Check if an extension (ext) is provided
		if (ext) {
			// Iterate through all registered grammars in Atom
			for (const grammar of atom.grammars.getGrammars()) {
				// Iterate through the file types associated with each grammar
				for (const fileType of grammar.fileTypes) {
					// If the provided extension matches a registered file type, return the grammar name
					if (ext === `.${fileType}`) {
						return grammar.name;
					}
				}
			}
		} else {
			// If no extension is provided, get the grammar name of the active text editor
			return atom.workspace.getActiveTextEditor().getGrammar().name;
		}
	},

	getCommand(fileType) {
		// Determine the appropriate compiler command based on the file type
		switch (fileType) {
			case "C":
				return atom.config.get("pulsar-gpp-compiler.cCompiler");
			case "C++":
				return atom.config.get("pulsar-gpp-compiler.cppCompiler");
		}
	},

	getFilePath() {
		// Get the file path of the active text editor's buffer
		return atom.workspace.getActiveTextEditor().buffer.file;
	},

	getArgs(files, output, fileType, extraArgs) {
		if (!extraArgs) {
			extraArgs = [];
		}

		// Assemble an array of compiler arguments
		const args = [
			...extraArgs,
			...files,
			"-o",
			output,
			...atom.config
				.get(
					`pulsar-gpp-compiler.c${
						fileType === "C++" ? "pp" : ""
					}CompilerOptions`
				)
				.split(" ")
				.filter(Boolean),
		];

		this.debug("compiler args", args);

		return args;
	},

	getCompiledPath(dir, base) {
		if (atom.config.get("pulsar-gpp-compiler.compileToTmpDirectory")) {
			// If configured to compile to a temporary directory, use the system's temporary directory
			return path.join(os.tmpdir(), base);
		} else {
			// Otherwise, use the specified directory
			return path.join(dir, base);
		}
	},
};
