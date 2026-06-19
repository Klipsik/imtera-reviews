<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationType extends Model
{
    protected $fillable = ['name'];

    public function organizations(): HasMany
    {
        return $this->hasMany(Organization::class);
    }
}
