import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { GradingService } from './grading.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  controllers: [TestsController],
  providers: [TestsService, GradingService, CertificateService],
})
export class TestsModule {}
