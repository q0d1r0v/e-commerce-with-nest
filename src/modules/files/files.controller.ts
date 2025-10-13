import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { FilesService } from './files.service';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Files')
@UseGuards(RolesGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('/admin/upload')
  @Roles(['ADMIN'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, cb) => {
          const originalName = file.originalname;
          const ext = originalName.includes('.')
            ? originalName.split('.').pop()
            : '';
          const baseName = ext
            ? originalName.replace(`.${ext}`, '')
            : originalName;

          const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

          const uniqueName = ext
            ? `${safeBaseName}-${uuidv4()}.${ext}`
            : `${safeBaseName}-${uuidv4()}`;

          cb(null, uniqueName);
        },
      }),
      fileFilter: (_, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload new file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.filesService.upload(file);
  }

  @Post('/admin/upload-multiple')
  @Roles(['ADMIN'])
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, cb) => {
          const originalName = file.originalname;
          const ext = originalName.includes('.')
            ? originalName.split('.').pop()
            : '';
          const baseName = ext
            ? originalName.replace(`.${ext}`, '')
            : originalName;

          const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

          const uniqueName = ext
            ? `${safeBaseName}-${uuidv4()}.${ext}`
            : `${safeBaseName}-${uuidv4()}`;

          cb(null, uniqueName);
        },
      }),
      fileFilter: (_, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    return this.filesService.uploadMany(files);
  }

  @Get('/admin/get/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Get file by ID' })
  async findOne(@Param('id') id: string) {
    return this.filesService.findById(id);
  }

  @Get('/admin/load')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Get all files with pagination' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.filesService.findAll(pagination, search);
  }

  @Patch('/admin/update/:id')
  @Roles(['ADMIN'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, cb) => {
          const originalName = file.originalname;
          const ext = originalName.includes('.')
            ? originalName.split('.').pop()
            : '';
          const baseName = ext
            ? originalName.replace(`.${ext}`, '')
            : originalName;

          const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

          const uniqueName = ext
            ? `${safeBaseName}-${uuidv4()}.${ext}`
            : `${safeBaseName}-${uuidv4()}`;

          cb(null, uniqueName);
        },
      }),
      fileFilter: (_, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Update file (replace existing one)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.update(id, file);
  }

  @Delete('/admin/delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Soft delete file' })
  async delete(@Param('id') id: string) {
    await this.filesService.delete(id);
    return { message: `File with id ${id} has been soft deleted` };
  }

  @Patch('/admin/restore/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Restore deleted file' })
  async restore(@Param('id') id: string) {
    await this.filesService.restore(id);
    return { message: `File with id ${id} has been restored` };
  }
}
