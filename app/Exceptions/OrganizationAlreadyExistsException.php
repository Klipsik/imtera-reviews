<?php

namespace App\Exceptions;

use App\Models\Organization;
use RuntimeException;

class OrganizationAlreadyExistsException extends RuntimeException
{
    public function __construct(public Organization $organization)
    {
        parent::__construct('Организация уже добавлена');
    }
}
