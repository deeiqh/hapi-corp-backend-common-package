import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Cache } from 'cache-manager';
import { EVALUATED_OPERATION_OTP } from './events/topics';

export interface ResultMessage {
  resultMessage: { message: string; statusCode: string };
}

@Injectable()
export class ValidateOperationOtpService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject('CLIENT_KAFKA') private readonly clientKafka: ClientKafka,
  ) {}

  async validateOperationOtp(input: {
    operationUUID: string;
    code: string;
  }): Promise<ResultMessage> {
    const { operationUUID, code } = input;

    const { code: codeCached } =
      ((await this.cacheManager.get(operationUUID)) as any) || {};

    const isValid = codeCached === code;

    if (!codeCached || isValid) {
      this.clientKafka.emit(EVALUATED_OPERATION_OTP, {
        operationUUID,
        isValid,
      });

      if (!codeCached) {
        return {
          resultMessage: {
            message: 'Operation timed out',
            statusCode: '200',
          },
        };
      }

      await this.cacheManager.del(operationUUID);

      return {
        resultMessage: { message: 'Validated code', statusCode: '200' },
      };
    }

    return {
      resultMessage: { message: 'Wrong code', statusCode: '200' },
    };
  }
}
