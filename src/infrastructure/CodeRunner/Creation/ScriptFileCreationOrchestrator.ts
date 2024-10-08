import { ElectronLogger } from '@/infrastructure/Log/ElectronLogger';
import type { Logger } from '@/application/Common/Log/Logger';
import type { CodeRunError, CodeRunErrorType } from '@/application/CodeRunner/CodeRunner';
import { FileReadbackVerificationErrors, type ReadbackFileWriter } from '@/infrastructure/FileSystem/ReadbackFileWriter/ReadbackFileWriter';
import { NodeReadbackFileWriter } from '@/infrastructure/FileSystem/ReadbackFileWriter/NodeReadbackFileWriter';
import { NodeElectronFileSystemOperations } from '@/infrastructure/FileSystem/NodeElectronFileSystemOperations';
import { PersistentApplicationDirectoryProvider } from '@/infrastructure/FileSystem/Directory/PersistentApplicationDirectoryProvider';
import type { FileSystemOperations } from '@/infrastructure/FileSystem/FileSystemOperations';
import type { ApplicationDirectoryProvider } from '@/infrastructure/FileSystem/Directory/ApplicationDirectoryProvider';
import { TimestampedFilenameGenerator } from './Filename/TimestampedFilenameGenerator';
import type { FilenameGenerator } from './Filename/FilenameGenerator';
import type { ScriptFilenameParts, ScriptFileCreator, ScriptFileCreationOutcome } from './ScriptFileCreator';

export class ScriptFileCreationOrchestrator implements ScriptFileCreator {
  constructor(
    private readonly fileSystem: FileSystemOperations = NodeElectronFileSystemOperations,
    private readonly filenameGenerator: FilenameGenerator = new TimestampedFilenameGenerator(),
    private readonly directoryProvider: ApplicationDirectoryProvider
    = new PersistentApplicationDirectoryProvider(),
    private readonly fileWriter: ReadbackFileWriter = new NodeReadbackFileWriter(),
    private readonly logger: Logger = ElectronLogger,
  ) { }

  public async createScriptFile(
    contents: string,
    scriptFilenameParts: ScriptFilenameParts,
  ): Promise<ScriptFileCreationOutcome> {
    const {
      success: isDirectoryCreated, error: directoryCreationError, directoryAbsolutePath,
    } = await this.directoryProvider.provideDirectory('script-runs');
    if (!isDirectoryCreated) {
      return createFailure({
        type: 'DirectoryCreationError',
        message: `[${directoryCreationError.type}] ${directoryCreationError.message}`,
      });
    }
    const {
      success: isFilePathConstructed, error: filePathGenerationError, filePath,
    } = this.constructFilePath(scriptFilenameParts, directoryAbsolutePath);
    if (!isFilePathConstructed) {
      return createFailure(filePathGenerationError);
    }
    const {
      success: isFileCreated, error: fileCreationError,
    } = await this.writeFile(filePath, contents);
    if (!isFileCreated) {
      return createFailure(fileCreationError);
    }
    return {
      success: true,
      scriptFileAbsolutePath: filePath,
    };
  }

  private constructFilePath(
    scriptFilenameParts: ScriptFilenameParts,
    directoryPath: string,
  ): FilePathConstructionOutcome {
    try {
      const filename = this.filenameGenerator.generateFilename(scriptFilenameParts);
      const filePath = this.fileSystem.combinePaths(directoryPath, filename);
      return { success: true, filePath };
    } catch (error) {
      return {
        success: false,
        error: this.handleException(error, 'FilePathGenerationError'),
      };
    }
  }

  private async writeFile(
    filePath: string,
    contents: string,
  ): Promise<FileWriteOutcome> {
    const {
      success, error,
    } = await this.fileWriter.writeAndVerifyFile(filePath, contents);
    if (success) {
      return { success: true };
    }
    return {
      success: false,
      error: {
        message: error.message,
        type: FileReadbackVerificationErrors.find((e) => e === error.type) ? 'FileReadbackVerificationError' : 'FileWriteError',
      },
    };
  }

  private handleException(
    exception: Error,
    errorType: CodeRunErrorType,
  ): CodeRunError {
    const errorMessage = 'Error during script file operation';
    this.logger.error(errorType, errorMessage, exception);
    return {
      type: errorType,
      message: `${errorMessage}: ${exception.message}`,
    };
  }
}

function createFailure(error: CodeRunError): ScriptFileCreationOutcome {
  return {
    success: false,
    error,
  };
}

type FileWriteOutcome = {
  readonly success: true;
  readonly error?: undefined;
} | {
  readonly success: false;
  readonly error: CodeRunError;
};

type FilePathConstructionOutcome = {
  readonly success: true;
  readonly filePath: string;
  readonly error?: undefined;
} | {
  readonly success: false;
  readonly filePath?: undefined;
  readonly error: CodeRunError;
};
